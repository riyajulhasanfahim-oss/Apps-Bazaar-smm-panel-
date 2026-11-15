import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Wallet,
  Wifi,
  X,
} from 'lucide-react';
import { APP_CONFIG } from '../../config/app.config';
import { useApp } from '../../context/AppContext';
import { maskSecretValue } from '../../lib/firebase/configManager';
import {
  adminPanelService,
  type AdminApiProviderItem,
  type AdminCategoryItem,
  type AdminServiceItem,
} from '../../services/adminPanel.service';
import {
  getProviderAdapter,
  suggestPlatformAndTypeFromImported,
  type ProviderServiceDTO,
} from '../../services/providerAdapter';
import { SERVICE_TYPE_OPTIONS, type ServiceType } from '../../types/service.types';

interface ConnectionFeedback {
  ok: boolean;
  message: string;
  balance?: number;
  currency?: string;
}

export function AdminProvidersView() {
  const { showToast, systemSettings, gatewayLock } = useApp();
  const currencySymbol = systemSettings?.currencySymbol?.trim() || APP_CONFIG.currencySymbol;
  const currencyCode = systemSettings?.currency?.trim() || APP_CONFIG.currencyCode;
  const [providers, setProviders] = useState<AdminApiProviderItem[]>([]);
  const [services, setServices] = useState<AdminServiceItem[]>([]);
  const [categories, setCategories] = useState<AdminCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [balanceLoadingId, setBalanceLoadingId] = useState<string | null>(null);
  const [connectionResults, setConnectionResults] = useState<Record<string, ConnectionFeedback>>(
    {}
  );

  // Add/Edit Provider modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminApiProviderItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminApiProviderItem | null>(null);
  const [name, setName] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [providerFormat, setProviderFormat] = useState('standard_v2');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [saving, setSaving] = useState(false);
  const [modalTesting, setModalTesting] = useState(false);
  const [modalTestResult, setModalTestResult] = useState<ConnectionFeedback | null>(null);

  // Service Import & Review modal state
  const [importProvider, setImportProvider] = useState<AdminApiProviderItem | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedList, setImportedList] = useState<ProviderServiceDTO[]>([]);
  const [importSearch, setImportSearch] = useState('');
  const [importCategoryFilter, setImportCategoryFilter] = useState('all');

  // Review-before-publish form for a single selected imported service
  const [reviewItem, setReviewItem] = useState<ProviderServiceDTO | null>(null);
  const [rvCategoryId, setRvCategoryId] = useState('instagram');
  const [rvServiceType, setRvServiceType] = useState<ServiceType>('Followers');
  const [rvName, setRvName] = useState('');
  const [rvDescription, setRvDescription] = useState('');
  const [rvCostPrice, setRvCostPrice] = useState('0');
  const [rvSellingPrice, setRvSellingPrice] = useState('0');
  const [rvMinQty, setRvMinQty] = useState('100');
  const [rvMaxQty, setRvMaxQty] = useState('10000');
  const [rvAvgTime, setRvAvgTime] = useState('15 minutes');
  const [rvDeliverySpeed, setRvDeliverySpeed] = useState('Instant Delivery');
  const [rvRefill, setRvRefill] = useState(false);
  const [rvStatus, setRvStatus] = useState<'active' | 'inactive'>('inactive');
  const [rvSaving, setRvSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [provList, srvList, catList] = await Promise.all([
        adminPanelService.listApiProviders(),
        adminPanelService.listServicesAdmin(),
        adminPanelService.listCategories(),
      ]);
      setProviders(provList);
      setServices(srvList);
      setCategories(catList);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const mappedCountsByProvider = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of services) {
      if (s.providerId) {
        counts.set(s.providerId, (counts.get(s.providerId) ?? 0) + 1);
      }
    }
    return counts;
  }, [services]);

  const mappedServiceKeysForImport = useMemo(() => {
    if (!importProvider) return new Set<string>();
    return new Set(
      services
        .filter((s) => s.providerId === importProvider.id && s.providerServiceId)
        .map((s) => s.providerServiceId)
    );
  }, [importProvider, services]);

  const importCategories = useMemo(() => {
    const set = new Set<string>();
    for (const item of importedList) {
      if (item.category) set.add(item.category);
    }
    return Array.from(set).sort();
  }, [importedList]);

  const filteredImported = useMemo(() => {
    const q = importSearch.trim().toLowerCase();
    return importedList.filter((item) => {
      if (importCategoryFilter !== 'all' && item.category !== importCategoryFilter) return false;
      if (!q) return true;
      return (
        item.providerServiceId.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [importedList, importSearch, importCategoryFilter]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setApiUrl('https://');
    setApiKey('');
    setProviderFormat('standard_v2');
    setStatus('active');
    setModalTestResult(null);
    setModalOpen(true);
  };

  const openEdit = (prov: AdminApiProviderItem) => {
    setEditing(prov);
    setName(prov.name);
    setApiUrl(prov.apiUrl);
    setApiKey(prov.apiKey);
    setProviderFormat(prov.providerFormat || 'standard_v2');
    setStatus(prov.status);
    setModalTestResult(null);
    setModalOpen(true);
  };

  const handleTestInModal = async () => {
    setModalTesting(true);
    setModalTestResult(null);
    try {
      const adapter = getProviderAdapter(providerFormat);
      const res = await adapter.testConnection({
        apiUrl,
        apiKey,
        format: providerFormat,
      });
      setModalTestResult({
        ok: true,
        message: res.message,
        balance: res.balance,
        currency: res.currency,
      });
    } catch (err) {
      setModalTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Connection test failed.',
      });
    } finally {
      setModalTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminPanelService.saveApiProvider({
        id: editing?.id,
        name,
        apiUrl,
        apiKey,
        providerFormat,
        status,
      });
      showToast({
        title: editing ? 'Provider Updated' : 'Provider Added',
        description: `${name} configuration stored securely in Firestore.`,
        tone: 'success',
      });
      setModalOpen(false);
      await loadData();
    } catch (err) {
      showToast({
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Unable to save provider.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (prov: AdminApiProviderItem) => {
    const nextStatus = prov.status === 'active' ? 'inactive' : 'active';
    try {
      await adminPanelService.saveApiProvider({
        ...prov,
        status: nextStatus,
      });
      setProviders((prev) =>
        prev.map((p) => (p.id === prov.id ? { ...p, status: nextStatus } : p))
      );
      showToast({
        title: 'Provider Status Updated',
        description: `${prov.name} is now ${nextStatus}.`,
        tone: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Unable to update status.',
        tone: 'error',
      });
    }
  };

  const handleTestCardConnection = async (prov: AdminApiProviderItem) => {
    setTestingId(prov.id);
    try {
      const adapter = getProviderAdapter(prov.providerFormat);
      const res = await adapter.testConnection({
        apiUrl: prov.apiUrl,
        apiKey: prov.apiKey,
        format: prov.providerFormat,
      });
      setConnectionResults((prev) => ({
        ...prev,
        [prov.id]: {
          ok: true,
          message: res.message,
          balance: res.balance,
          currency: res.currency,
        },
      }));
      if (typeof res.balance === 'number') {
        await adminPanelService.saveProviderBalance(prov.id, res.balance, res.currency ?? 'USD');
        setProviders((prev) =>
          prev.map((p) =>
            p.id === prov.id
              ? {
                  ...p,
                  lastBalance: res.balance,
                  lastBalanceCurrency: res.currency ?? 'USD',
                }
              : p
          )
        );
      }
      showToast({
        title: 'API Connection Successful',
        description:
          typeof res.balance === 'number'
            ? `${prov.name} responded cleanly (Balance: ${res.balance.toFixed(2)} ${res.currency ?? 'USD'}).`
            : `${prov.name} responded cleanly.`,
        tone: 'success',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach provider endpoint.';
      setConnectionResults((prev) => ({
        ...prev,
        [prov.id]: {
          ok: false,
          message: msg,
        },
      }));
      showToast({
        title: 'Connection Failed',
        description: msg,
        tone: 'error',
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleRefreshBalance = async (prov: AdminApiProviderItem) => {
    setBalanceLoadingId(prov.id);
    try {
      const adapter = getProviderAdapter(prov.providerFormat);
      const bal = await adapter.getBalance({
        apiUrl: prov.apiUrl,
        apiKey: prov.apiKey,
        format: prov.providerFormat,
      });
      await adminPanelService.saveProviderBalance(prov.id, bal.balance, bal.currency);
      setProviders((prev) =>
        prev.map((p) =>
          p.id === prov.id
            ? { ...p, lastBalance: bal.balance, lastBalanceCurrency: bal.currency }
            : p
        )
      );
      showToast({
        title: 'Balance Synced',
        description: `${prov.name} balance: ${bal.balance.toFixed(2)} ${bal.currency}.`,
        tone: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Balance Check Failed',
        description: err instanceof Error ? err.message : 'Could not fetch provider balance.',
        tone: 'error',
      });
    } finally {
      setBalanceLoadingId(null);
    }
  };

  const openImportDrawer = async (prov: AdminApiProviderItem) => {
    setImportProvider(prov);
    setImportLoading(true);
    setImportError(null);
    setImportedList([]);
    setImportSearch('');
    setImportCategoryFilter('all');
    setReviewItem(null);

    try {
      const adapter = getProviderAdapter(prov.providerFormat);
      const list = await adapter.getServices({
        apiUrl: prov.apiUrl,
        apiKey: prov.apiKey,
        format: prov.providerFormat,
      });
      setImportedList(list);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to fetch provider services.');
    } finally {
      setImportLoading(false);
    }
  };

  const openReviewForImported = (item: ProviderServiceDTO) => {
    const defaultCat = categories[0]?.id ?? 'instagram';
    const suggested = suggestPlatformAndTypeFromImported(item.name, item.category, defaultCat);
    const matchingCategory = categories.some((c) => c.id === suggested.categoryId)
      ? suggested.categoryId
      : defaultCat;

    const cost = Number(item.rate || 0);
    const suggestedSell = Number((cost * 1.35).toFixed(2));

    setReviewItem(item);
    setRvCategoryId(matchingCategory);
    setRvServiceType(suggested.serviceType);
    setRvName(item.name.slice(0, 155));
    setRvDescription(item.description || `${item.category} (${item.type})`);
    setRvCostPrice(cost.toFixed(2));
    setRvSellingPrice(suggestedSell.toFixed(2));
    setRvMinQty(String(item.min));
    setRvMaxQty(String(item.max));
    setRvAvgTime('15 minutes');
    setRvDeliverySpeed(item.dripfeed ? 'Drip-feed Enabled' : 'Instant Delivery');
    setRvRefill(item.refill);
    setRvStatus('inactive'); // Safe default: Admin explicitly chooses Active vs Draft before publishing
  };

  const handlePublishReviewedService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importProvider || !reviewItem) return;

    setRvSaving(true);
    try {
      await adminPanelService.saveService({
        categoryId: rvCategoryId,
        name: rvName,
        serviceType: rvServiceType,
        description: rvDescription,
        providerId: importProvider.id,
        providerServiceId: reviewItem.providerServiceId,
        costPrice: Number(rvCostPrice),
        sellingPrice: Number(rvSellingPrice),
        minQuantity: Number(rvMinQty),
        maxQuantity: Number(rvMaxQty),
        averageTime: rvAvgTime,
        deliverySpeed: rvDeliverySpeed,
        refillGuaranteed: rvRefill,
        status: rvStatus,
      });

      showToast({
        title: rvStatus === 'active' ? 'Service Published' : 'Service Saved as Draft',
        description: `${rvName} mapped to ${importProvider.name} (#${reviewItem.providerServiceId}).`,
        tone: 'success',
      });
      setReviewItem(null);
      await loadData();
    } catch (err) {
      showToast({
        title: 'Import Save Failed',
        description: err instanceof Error ? err.message : 'Unable to save imported service.',
        tone: 'error',
      });
    } finally {
      setRvSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await adminPanelService.deleteApiProvider(confirmDelete.id);
      setProviders((prev) => prev.filter((p) => p.id !== confirmDelete.id));
      showToast({
        title: 'Provider Removed',
        description: `${confirmDelete.name} deleted.`,
        tone: 'info',
      });
      setConfirmDelete(null);
    } catch (err) {
      showToast({
        title: 'Delete Failed',
        description: err instanceof Error ? err.message : 'Unable to delete provider.',
        tone: 'error',
      });
    }
  };

  const reviewGrossMargin = Number(rvSellingPrice || 0) - Number(rvCostPrice || 0);

  if (gatewayLock.locked) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            Official API Provider Connection
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            This installation is permanently bound to the official gateway provider at the server level.
          </p>
        </div>

        <div className="rounded-3xl border border-violet-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700">
                  Server-Enforced Lock Active
                </p>
                <h2 className="font-display text-lg font-extrabold text-slate-950">
                  {gatewayLock.providerLabel}
                </h2>
              </div>
            </div>
            <span className="text-xs font-bold uppercase text-emerald-700">Connected</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs">
            <div>
              <p className="text-slate-500">Installation ID</p>
              <p className="mt-0.5 font-mono font-bold text-slate-900">
                {gatewayLock.installationId || systemSettings?.installationId || 'Server Bound'}
              </p>
            </div>
            <div>
              <p className="text-slate-500">API Customer Binding</p>
              <p className="mt-0.5 font-mono font-bold text-slate-900">
                {gatewayLock.apiCustomerId || 'Protected Gateway Account'}
              </p>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-600">
            Custom upstream provider URLs, third-party API keys, and manual provider additions are
            disabled on this deployment. All order dispatches and status synchronizations route
            securely through <strong className="text-slate-900">{gatewayLock.providerLabel}</strong>{' '}
            using server-side credentials.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            API Providers Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Connect multiple upstream SMM panels, test connections, monitor balances, and review services before publishing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white hover:bg-violet-800"
          >
            <Plus className="h-4 w-4" />
            <span>Add Provider</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-900 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" />
        <span>
          API Keys stay masked in Admin UI, execute strictly via backend proxy routes, and are blocked by{' '}
          <code className="font-mono">isAdmin()</code> rules so customers never see provider endpoints or secrets.
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {providers.map((prov) => {
          const revealed = Boolean(revealedIds[prov.id]);
          const connResult = connectionResults[prov.id];
          const mappedCount = mappedCountsByProvider.get(prov.id) ?? 0;

          return (
            <div
              key={prov.id}
              className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10px] text-slate-400">ID: {prov.id}</span>
                    <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                      Standard v2
                    </span>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      {mappedCount} mapped
                    </span>
                  </div>
                  <h2 className="mt-0.5 font-display text-base font-bold text-slate-900 truncate">
                    {prov.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(prov)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold shrink-0 ${
                    prov.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {prov.status}
                </button>
              </div>

              {/* Balance + API Credentials */}
              <div className="space-y-2 rounded-2xl bg-slate-50 p-3.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Wallet className="h-3.5 w-3.5 text-violet-700" />
                    <span className="font-semibold">Provider Balance:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {typeof prov.lastBalance === 'number'
                        ? `${prov.lastBalance.toFixed(2)} ${prov.lastBalanceCurrency ?? 'USD'}`
                        : 'Not synced'}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={balanceLoadingId === prov.id}
                    onClick={() => handleRefreshBalance(prov)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${balanceLoadingId === prov.id ? 'animate-spin' : ''}`}
                    />
                    <span>Check Balance</span>
                  </button>
                </div>

                <p className="truncate">
                  <span className="font-semibold text-slate-600">API URL:</span>{' '}
                  <span className="font-mono text-slate-800">{prov.apiUrl}</span>
                </p>

                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-mono text-slate-700">
                    <span className="font-sans font-semibold text-slate-600">API Key: </span>
                    {revealed ? prov.apiKey : maskSecretValue(prov.apiKey || '••••••••')}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setRevealedIds((prev) => ({ ...prev, [prov.id]: !prev[prov.id] }))
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shrink-0"
                  >
                    {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>{revealed ? 'Mask' : 'Reveal'}</span>
                  </button>
                </div>
              </div>

              {connResult && (
                <div
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
                    connResult.ok
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-rose-200 bg-rose-50 text-rose-900'
                  }`}
                >
                  {connResult.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold">{connResult.message}</p>
                    {connResult.ok && typeof connResult.balance === 'number' && (
                      <p className="text-[11px] opacity-85">
                        Available provider credit: {connResult.balance.toFixed(2)}{' '}
                        {connResult.currency ?? 'USD'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-400">Updated {prov.updatedAtLabel}</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={testingId === prov.id}
                    onClick={() => handleTestCardConnection(prov)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 text-xs font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-60"
                  >
                    {testingId === prov.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wifi className="h-3.5 w-3.5" />
                    )}
                    <span>Test Connection</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openImportDrawer(prov)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-violet-700 px-2.5 text-xs font-semibold text-white hover:bg-violet-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Import Services</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(prov)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(prov)}
                    className="inline-flex h-8 items-center rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    aria-label={`Delete ${prov.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && providers.length === 0 && (
          <div className="lg:col-span-2 rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-xs text-slate-400">
            No API providers configured yet. Click &ldquo;Add Provider&rdquo; to store your first supplier endpoint.
          </div>
        )}
      </div>

      {/* Add/Edit Provider Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editing ? 'Edit API Provider' : 'Add API Provider'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Provider Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="PrimeSMM Hub"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  API Adapter Format
                </label>
                <select
                  value={providerFormat}
                  onChange={(e) => setProviderFormat(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                >
                  <option value="standard_v2">Standard SMM Panel API v2</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">API URL</label>
                <input
                  type="url"
                  required
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://provider.example/api/v2"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">API Key</label>
                <input
                  type="password"
                  required
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter secret API key"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {modalTestResult && (
                <div
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    modalTestResult.ok
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-rose-200 bg-rose-50 text-rose-900'
                  }`}
                >
                  <p className="font-semibold">{modalTestResult.message}</p>
                  {modalTestResult.ok && typeof modalTestResult.balance === 'number' && (
                    <p className="text-[11px]">
                      Provider Balance: {modalTestResult.balance.toFixed(2)}{' '}
                      {modalTestResult.currency ?? 'USD'}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  disabled={modalTesting || !apiUrl || !apiKey}
                  onClick={handleTestInModal}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 text-xs font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-60"
                >
                  {modalTesting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wifi className="h-3.5 w-3.5" />
                  )}
                  <span>Test Connection</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-10 rounded-xl bg-violet-700 px-5 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save Provider'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Services & Mandatory Review Modal */}
      {importProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 truncate">
                  Import Services from {importProvider.name}
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  Review each imported item, configure customer name, category, and selling price before saving. Zero auto-publish.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setImportProvider(null);
                  setReviewItem(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {reviewItem ? (
              <form
                onSubmit={handlePublishReviewedService}
                className="flex-1 overflow-y-auto p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-violet-200 bg-violet-50/70 px-4 py-3 text-xs">
                  <div>
                    <p className="font-bold text-violet-950">
                      Reviewing Provider Service #{reviewItem.providerServiceId}
                    </p>
                    <p className="text-[11px] text-violet-800">
                      Original: {reviewItem.name} · Provider Cost: {reviewItem.rate} / 1K
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReviewItem(null)}
                    className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100"
                  >
                    Back to Imported List
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Local Category
                    </label>
                    <select
                      required
                      value={rvCategoryId}
                      onChange={(e) => setRvCategoryId(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Service Type
                    </label>
                    <select
                      value={rvServiceType}
                      onChange={(e) => setRvServiceType(e.target.value as ServiceType)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                    >
                      {SERVICE_TYPE_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Publish Status
                    </label>
                    <select
                      value={rvStatus}
                      onChange={(e) => setRvStatus(e.target.value as 'active' | 'inactive')}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold"
                    >
                      <option value="inactive">Inactive (Draft Review)</option>
                      <option value="active">Active (Live to Customers)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Service Name
                  </label>
                  <input
                    type="text"
                    required
                    value={rvName}
                    onChange={(e) => setRvName(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Description
                  </label>
                  <textarea
                    rows={2}
                    value={rvDescription}
                    onChange={(e) => setRvDescription(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cost Price / 1K ({APP_CONFIG.currencyCode})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={rvCostPrice}
                      onChange={(e) => setRvCostPrice(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Customer Selling Price / 1K ({currencyCode})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={rvSellingPrice}
                      onChange={(e) => setRvSellingPrice(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-violet-50 px-3.5 py-2 text-xs font-semibold text-violet-900">
                  Gross Margin Preview per 1,000:{' '}
                  <span className={reviewGrossMargin >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                    {currencySymbol}
                    {reviewGrossMargin.toFixed(2)}
                  </span>{' '}
                  <span className="font-normal text-slate-500">
                    (Before payment fees or refunds)
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Min Qty</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={rvMinQty}
                      onChange={(e) => setRvMinQty(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Max Qty</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={rvMaxQty}
                      onChange={(e) => setRvMaxQty(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Average Time
                    </label>
                    <input
                      type="text"
                      value={rvAvgTime}
                      onChange={(e) => setRvAvgTime(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Speed Label
                    </label>
                    <input
                      type="text"
                      value={rvDeliverySpeed}
                      onChange={(e) => setRvDeliverySpeed(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                    />
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={rvRefill}
                    onChange={(e) => setRvRefill(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-violet-700"
                  />
                  <span>Refill Guarantee Enabled</span>
                </label>

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setReviewItem(null)}
                    className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={rvSaving}
                    className="h-10 rounded-xl bg-violet-700 px-5 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60"
                  >
                    {rvSaving ? 'Saving...' : 'Confirm & Save Service'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-1 flex-col overflow-hidden p-5 space-y-3">
                <div className="grid gap-2.5 sm:grid-cols-12">
                  <div className="relative sm:col-span-7">
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={importSearch}
                      onChange={(e) => setImportSearch(e.target.value)}
                      placeholder="Search Provider Service ID, Name, or Category..."
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs sm:text-sm"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <select
                      value={importCategoryFilter}
                      onChange={(e) => setImportCategoryFilter(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm"
                    >
                      <option value="all">
                        All Provider Categories ({importedList.length})
                      </option>
                      {importCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {importLoading ? (
                  <div className="flex flex-1 flex-col items-center justify-center py-12 text-xs text-slate-500 gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-violet-700" />
                    <span>Fetching live service catalog from {importProvider.name}...</span>
                  </div>
                ) : importError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-xs text-rose-800 space-y-2">
                    <p className="font-bold">Could not load services from {importProvider.name}</p>
                    <p>{importError}</p>
                    <button
                      type="button"
                      onClick={() => openImportDrawer(importProvider)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-700 px-4 text-xs font-bold text-white"
                    >
                      Retry Fetch
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200/80 divide-y divide-slate-100">
                    {filteredImported.slice(0, 150).map((item) => {
                      const alreadyMapped = mappedServiceKeysForImport.has(item.providerServiceId);
                      return (
                        <div
                          key={item.providerServiceId}
                          className="flex flex-col gap-2.5 p-3.5 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/80"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                                #{item.providerServiceId}
                              </span>
                              <span className="text-[11px] font-semibold text-violet-700">
                                {item.category}
                              </span>
                              {item.refill && (
                                <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                  Refill
                                </span>
                              )}
                              {alreadyMapped && (
                                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                  Already Mapped
                                </span>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-slate-900">
                              {item.name}
                            </p>
                            <p className="text-[11px] text-slate-500 tabular-nums">
                              Provider Rate: <span className="font-semibold">{item.rate}/1K</span> ·
                              Min {item.min.toLocaleString()} – Max {item.max.toLocaleString()}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={alreadyMapped}
                            onClick={() => openReviewForImported(item)}
                            className={`inline-flex h-9 items-center justify-center rounded-xl px-3.5 text-xs font-bold shrink-0 ${
                              alreadyMapped
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-violet-700 text-white hover:bg-violet-800'
                            }`}
                          >
                            {alreadyMapped ? 'Mapped' : 'Review & Configure'}
                          </button>
                        </div>
                      );
                    })}

                    {filteredImported.length === 0 && (
                      <div className="p-10 text-center text-xs text-slate-400">
                        No imported provider services match your search filters.
                      </div>
                    )}
                    {filteredImported.length > 150 && (
                      <div className="bg-slate-50 px-4 py-2 text-center text-[11px] text-slate-500">
                        Showing first 150 of {filteredImported.length} services. Refine search or category filter to narrow results.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
            <h3 className="font-display text-base font-bold text-slate-900">Delete Provider?</h3>
            <p className="mt-1.5 text-xs text-slate-600">
              Remove <span className="font-semibold">{confirmDelete.name}</span>?
              {(mappedCountsByProvider.get(confirmDelete.id) ?? 0) > 0 && (
                <span className="mt-1.5 block font-semibold text-amber-700">
                  Warning: {mappedCountsByProvider.get(confirmDelete.id)} service(s) are currently mapped to this provider.
                </span>
              )}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="h-9 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
