import { useMemo, useState } from "react";
import ceraWalletLogo from "../assets/cera-wallet-logo.png";
import { DebugPanel } from "../components/DebugPanel";
import type { RecentSendItem } from "../components/RecentSendList";
import { useApiHealth } from "../hooks/useApiHealth";
import { useConsensusStatus } from "../hooks/useConsensusStatus";
import { useForkChoiceStatus } from "../hooks/useForkChoiceStatus";
import { useTxPolling } from "../hooks/useTxPolling";
import { useWalletSummary } from "../hooks/useWalletSummary";
import { TransactionTrackerPage } from "../pages/TransactionTrackerPage";
import { SendTransactionPage } from "../pages/SendTransactionPage";
import { WalletDashboardPage } from "../pages/WalletDashboardPage";
import { sendTransaction, type SendTxPayload } from "../services/tx";
import { getApiBaseUrl } from "../services/wallet";
import type { ApiError, SendTxResponse, StakingAction } from "../types/api";
import { fromSendResult } from "../types/tx-state";

type TabKey = "dashboard" | "send" | "tracker";

const NAV_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: "dashboard", label: "Wallet" },
  { key: "send", label: "Send" },
  { key: "tracker", label: "Tracker" }
];

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [address, setAddress] = useState("");
  const [sendFromAddress, setSendFromAddress] = useState("");
  const [suggestedNonce, setSuggestedNonce] = useState<number | null>(null);
  const [sendResult, setSendResult] = useState<SendTxResponse | null>(null);
  const [recentSends, setRecentSends] = useState<RecentSendItem[]>([]);
  const [sendError, setSendError] = useState<ApiError | null>(null);
  const [sending, setSending] = useState(false);
  const [trackedTxHash, setTrackedTxHash] = useState("");
  const [sendModeLabel, setSendModeLabel] = useState<string | null>(null);
  const [latestStakingAction, setLatestStakingAction] = useState<{
    action: StakingAction;
    from?: string;
    result: SendTxResponse;
    createdAt: string;
  } | null>(null);

  const apiHealth = useApiHealth();
  const forkChoice = useForkChoiceStatus();
  const consensus = useConsensusStatus(address);
  const wallet = useWalletSummary(address);
  const trackerInitialState = useMemo(
    () => (sendResult && sendResult.tx_hash === trackedTxHash ? fromSendResult(sendResult.mempool_status) : null),
    [sendResult, trackedTxHash]
  );
  const tracker = useTxPolling(trackedTxHash, trackerInitialState);

  function pushRecentSend(result: SendTxResponse, label?: string) {
    setRecentSends((current) => [
      { ...result, createdAt: new Date().toLocaleTimeString(), label },
      ...current
    ].slice(0, 8));
  }

  async function refreshAddressScopedViews(nextAddress?: string) {
    const normalized = nextAddress?.trim();
    const currentAddress = address.trim();

    if (normalized) {
      setAddress(normalized);
      setSendFromAddress(normalized);
    }

    if (normalized && normalized !== currentAddress) {
      await Promise.all([apiHealth.refresh(), forkChoice.refresh()]);
      return;
    }

    await Promise.all([wallet.refresh(), consensus.refresh(), apiHealth.refresh(), forkChoice.refresh()]);
  }

  async function handleSend(payload: SendTxPayload) {
    setSending(true);
    setSendError(null);

    try {
      const result = await sendTransaction(payload);
      setSendResult(result);
      pushRecentSend(result, "transfer");
      setTrackedTxHash(result.tx_hash);
      await refreshAddressScopedViews(payload.from);
      setSendModeLabel("Transfer flow");
      setActiveTab("tracker");
    } catch (error) {
      setSendError(error as ApiError);
    } finally {
      setSending(false);
    }
  }

  function handleUseAddress() {
    if (wallet.summary?.address) {
      setSendFromAddress(wallet.summary.address);
      setSendModeLabel("General send flow from wallet summary");
      setActiveTab("send");
    }
  }

  function handleUseNonce() {
    if (wallet.summary) {
      setSendFromAddress(wallet.summary.address);
      setSuggestedNonce(wallet.summary.next_nonce);
      setSendModeLabel("General send flow with dashboard nonce handoff");
      setActiveTab("send");
    }
  }

  function handleOpenStaking(addressOverride?: string) {
    const nextAddress = addressOverride?.trim() || wallet.summary?.address || address.trim();
    if (nextAddress) {
      setSendFromAddress(nextAddress);
      setAddress(nextAddress);
      setSuggestedNonce(wallet.summary?.address === nextAddress ? wallet.summary.next_nonce : suggestedNonce);
    }
    setSendModeLabel("Staking flow from dashboard context");
    setActiveTab("send");
  }

  async function handleStakingSuccess(result: SendTxResponse, meta: { action: StakingAction; from?: string }) {
    setSendResult(result);
    pushRecentSend(result, meta.action);
    setLatestStakingAction({
      action: meta.action,
      from: meta.from,
      result,
      createdAt: new Date().toLocaleTimeString()
    });
    setSendModeLabel(`Staking flow: ${meta.action}`);
    setTrackedTxHash(result.tx_hash);
    await refreshAddressScopedViews(meta.from);
    setActiveTab("tracker");
  }

  const heroSummary = useMemo(() => {
    if (wallet.summary) {
      return `Wallet action view ready for ${wallet.summary.address.slice(0, 14)}...`;
    }

    return "Use the wallet view to load an address, then send and track transactions against the frozen v0.1 protocol.";
  }, [wallet.summary]);

  const sendContextMatchesSelectedAddress =
    sendFromAddress.trim().length > 0 && sendFromAddress.trim() === address.trim();

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-brand">
          <img className="hero-logo" src={ceraWalletLogo} alt="CERA Wallet logo" />
          <div>
            <span className="eyebrow">CERA Wallet Frontend</span>
            <h1>Phase 1 Wallet Console</h1>
            <p>{heroSummary}</p>
          </div>
        </div>
        <nav className="nav-tabs" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.key === activeTab ? "nav-tab active" : "nav-tab"}
              onClick={() => setActiveTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </section>

      {activeTab === "dashboard" ? (
        <WalletDashboardPage
          address={address}
          onAddressChange={setAddress}
          onRefresh={() => void wallet.refresh()}
          loading={wallet.loading}
          error={wallet.error}
          summary={wallet.summary}
          pendingItems={wallet.pendingItems}
          onUseAddress={handleUseAddress}
          onUseNonce={handleUseNonce}
          onOpenStaking={handleOpenStaking}
          onWalletAddressSelected={(nextAddress) => void refreshAddressScopedViews(nextAddress)}
          health={apiHealth.health}
          healthError={apiHealth.error}
          healthLoading={apiHealth.loading}
          onRefreshHealth={() => void apiHealth.refresh()}
          forkChoiceStatus={forkChoice.status}
          forkChoiceError={forkChoice.error}
          forkChoiceLoading={forkChoice.loading}
          onRefreshForkChoice={() => void forkChoice.refresh()}
          validatorSet={consensus.validatorSet}
          checkpoints={consensus.checkpoints}
          finalized={consensus.finalized}
          stakingPolicy={consensus.stakingPolicy}
          consensusError={consensus.error}
          consensusLoading={consensus.loading}
          validator={consensus.validator}
          stakes={consensus.stakes}
          addressViewsError={consensus.addressViewsError}
          addressViewsLoading={consensus.addressViewsLoading}
          onRefreshConsensus={() => void consensus.refresh()}
          apiBaseUrl={getApiBaseUrl()}
        />
      ) : null}

      {activeTab === "send" ? (
        <SendTransactionPage
          fromAddress={sendFromAddress}
          suggestedNonce={suggestedNonce}
          sendModeLabel={sendModeLabel}
          onSubmit={handleSend}
          sending={sending}
          error={sendError}
          result={sendResult}
          recentSends={recentSends}
          stakingSummary={sendContextMatchesSelectedAddress ? wallet.summary : null}
          stakingValidator={sendContextMatchesSelectedAddress ? consensus.validator : null}
          stakingStakes={sendContextMatchesSelectedAddress ? consensus.stakes : null}
          stakingCheckpoints={consensus.checkpoints}
          stakingFinalized={consensus.finalized}
          stakingLoading={wallet.loading || consensus.addressViewsLoading || consensus.loading}
          stakingError={
            sendContextMatchesSelectedAddress
              ? wallet.error ?? consensus.addressViewsError ?? consensus.error
              : null
          }
          latestStakingAction={latestStakingAction}
          onStakingSuccess={(result, meta) => void handleStakingSuccess(result, meta)}
          onTrack={(txHash) => {
            setTrackedTxHash(txHash);
            setActiveTab("tracker");
          }}
        />
      ) : null}

      {activeTab === "tracker" ? (
        <TransactionTrackerPage
          txHash={trackedTxHash}
          onTxHashChange={setTrackedTxHash}
          onRefresh={() => void tracker.refresh()}
          loading={tracker.loading}
          error={tracker.error}
          state={tracker.state}
          receipt={tracker.receipt}
          pollingEnabled={tracker.pollingEnabled}
          onTogglePolling={tracker.setPollingEnabled}
          lastUpdatedAt={tracker.lastUpdatedAt}
        />
      ) : null}

      <DebugPanel
        forkChoiceStatus={forkChoice.status}
        forkChoiceError={forkChoice.error}
        forkChoiceLoading={forkChoice.loading}
      />
    </main>
  );
}
