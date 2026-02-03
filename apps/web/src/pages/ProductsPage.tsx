import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Package, Search, Upload, Pencil, Archive, RotateCcw, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { getToken } from "@/api/auth";
import { PageHeader, LoadingState, ErrorState } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";

const STATUS_TABS = [
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
  { label: "Archived", value: "archived" },
  { label: "All", value: "all" },
] as const;

type ProductStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

type Product = {
  id: string;
  name: string;
  productSource: "SHOPIFY" | "ETSY" | "BOTH";
  productType: string;
  status: ProductStatus;
  seasonality: string;
  updatedAt: string;
  archivedAt?: string | null;
};

type ProductsResponse = {
  ok: boolean;
  products: Product[];
};

type ImportSummary = {
  source: "SHOPIFY" | "ETSY";
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: Array<{ rowNumber: number; message: string }>;
};

type ProductFormState = {
  name: string;
  productSource: "SHOPIFY" | "ETSY";
  productType: string;
  status: ProductStatus;
  seasonality: string;
};

const DEFAULT_FORM: ProductFormState = {
  name: "",
  productSource: "SHOPIFY",
  productType: "unknown",
  status: "DRAFT",
  seasonality: "NONE",
};

const STATUS_OPTIONS: ProductStatus[] = ["ACTIVE", "DRAFT", "ARCHIVED"];
const SEASONALITY_OPTIONS = [
  "NONE",
  "VALENTINES",
  "EASTER",
  "BACK_TO_SCHOOL",
  "HALLOWEEN",
  "CHRISTMAS",
  "CUSTOM",
];

export default function ProductsPage() {
  const [statusScope, setStatusScope] = useState<typeof STATUS_TABS[number]["value"]>(
    "active"
  );
  const [search, setSearch] = useState("");
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formState, setFormState] = useState<ProductFormState>(DEFAULT_FORM);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const products = data?.products ?? [];

  const emptyMessage = useMemo(() => {
    if (statusScope === "archived") {
      return "Archived products will appear here once you archive them.";
    }
    if (statusScope === "draft") {
      return "Draft products help you prep decisions before going live.";
    }
    if (statusScope === "all") {
      return "Import or add products to start comparing decisions.";
    }
    return "No active products yet. Import your catalog to compare decisions.";
  }, [statusScope]);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ statusScope });
      if (search.trim()) {
        params.set("search", search.trim());
      }
      const res = await api<ProductsResponse>(`/products?${params.toString()}`);
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setBusy(false);
    }
  }, [search, statusScope]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    await load();
  }

  function openCreateDialog() {
    setEditingProduct(null);
    setFormState(DEFAULT_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(product: Product) {
    setEditingProduct(product);
    setFormState({
      name: product.name,
      productSource: product.productSource === "ETSY" ? "ETSY" : "SHOPIFY",
      productType: product.productType || "unknown",
      status: product.status,
      seasonality: product.seasonality || "NONE",
    });
    setDialogOpen(true);
  }

  async function submitForm() {
    setBusy(true);
    setError(null);
    try {
      if (editingProduct) {
        await api(`/products/${editingProduct.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: formState.name,
            productType: formState.productType,
            status: formState.status,
            seasonality: formState.seasonality,
          }),
        });
      } else {
        await api(`/products`, {
          method: "POST",
          body: JSON.stringify(formState),
        });
      }
      setDialogOpen(false);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save product");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive(product: Product) {
    setBusy(true);
    setError(null);
    try {
      await api(`/products/${product.id}/archive`, { method: "POST" });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to archive product");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(product: Product) {
    setBusy(true);
    setError(null);
    try {
      await api(`/products/${product.id}/restore`, { method: "POST" });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to restore product");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(product: Product) {
    setBusy(true);
    setError(null);
    try {
      await api(`/products/${product.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirm: true }),
      });
      setDeleteTarget(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete product");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File) {
    const token = getToken();
    const API_URL = import.meta.env.VITE_API_URL ?? "";
    const formData = new FormData();
    formData.append("file", file);

    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/products/import-csv`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body?.message || body?.error || `Import failed (${res.status})`;
        throw new Error(msg);
      }

      const summary = (await res.json()) as ImportSummary;
      setImportSummary(summary);
      toast({
        title: "Import complete",
        description: `${summary.createdCount} created, ${summary.updatedCount} updated, ${summary.skippedCount} skipped`,
      });
      await load();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Import failed";
      setError(message);
      toast({
        title: "Import failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Products" description="Manage your catalog across sources">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          title="Import CSV"
          aria-label="Import CSV"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleImport(file);
            }
          }}
        />
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          <Upload className="h-4 w-4" />
          Import CSV
        </Button>
        <Button size="sm" className="gap-2" onClick={openCreateDialog} disabled={busy}>
          <Package className="h-4 w-4" />
          Add Product
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-4 mb-6">
        <Tabs
          value={statusScope}
          onValueChange={(value) =>
            setStatusScope(value as typeof STATUS_TABS[number]["value"])
          }
        >
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or type"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="outline" size="sm" disabled={busy}>
            Search
          </Button>
          {search && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                void load();
              }}
            >
              Clear
            </Button>
          )}
        </form>
      </div>

      {importSummary && (
        <Card className="mb-6 border border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Import summary ({importSummary.source})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="secondary">Created: {importSummary.createdCount}</Badge>
              <Badge variant="secondary">Updated: {importSummary.updatedCount}</Badge>
              <Badge variant="secondary">Skipped: {importSummary.skippedCount}</Badge>
            </div>
            {importSummary.errors.length > 0 && (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium text-foreground mb-2">Row errors</p>
                <ul className="space-y-1 text-muted-foreground">
                  {importSummary.errors.map((errorItem) => (
                    <li key={`${errorItem.rowNumber}-${errorItem.message}`}>
                      Row {errorItem.rowNumber}: {errorItem.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && <ErrorState message={error} onRetry={load} />}
      {busy && !data && <LoadingState message="Loading products..." />}

      {!busy && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Catalog</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {products.length === 0 ? (
              <div className="p-8 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    No products to compare decisions yet
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{emptyMessage}</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Import CSV
                  </Button>
                  <Button size="sm" onClick={openCreateDialog}>
                    Add product manually
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Name</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Seasonality</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => {
                      const isArchived = Boolean(product.archivedAt);
                      return (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{product.productSource}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {product.productType || "unknown"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={product.status === "ACTIVE" ? "default" : "secondary"}>
                              {product.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{product.seasonality || "NONE"}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(product.updatedAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(product)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {isArchived ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRestore(product)}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleArchive(product)}
                                >
                                  <Archive className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteTarget(product)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit product" : "Add product"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="product-name">Name</Label>
              <Input
                id="product-name"
                value={formState.name}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Source</Label>
                <Select
                  value={formState.productSource}
                  onValueChange={(value) =>
                    setFormState((prev) => ({
                      ...prev,
                      productSource: value as ProductFormState["productSource"],
                    }))
                  }
                  disabled={Boolean(editingProduct)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SHOPIFY">SHOPIFY</SelectItem>
                    <SelectItem value="ETSY">ETSY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-type">Type</Label>
                <Input
                  id="product-type"
                  value={formState.productType}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, productType: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formState.status}
                  onValueChange={(value) =>
                    setFormState((prev) => ({
                      ...prev,
                      status: value as ProductStatus,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Seasonality</Label>
                <Select
                  value={formState.seasonality}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, seasonality: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEASONALITY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitForm} disabled={busy || !formState.name.trim()}>
              {editingProduct ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteTarget?.name}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  void handleDelete(deleteTarget);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
