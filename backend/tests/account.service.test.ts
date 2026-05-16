import test from "node:test";
import assert from "node:assert/strict";

import type { AccountRecord } from "../src/models/account.model.js";
import type { AccountRepository } from "../src/repositories/account.repository.js";
import { createAccountService } from "../src/services/account.service.js";
import { addressHexFromSeed, seedFromHex64 } from "../src/services/signer.js";

type TestAccountRecord = {
  ceraAddress: string;
  accountType?: string;
  authMode?: string;
  ed25519PublicKey?: string | null;
  pqPublicKey?: string | null;
  pqKeyId?: string;
  keyMaterialRef?: string | null;
  pqKeyMaterialRef?: string | null;
  migrationVersion?: number;
  derivationScheme?: string | null;
  derivationPath?: string | null;
  coinType?: number | null;
  accountIndex?: number | null;
  addressIndex?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
};

function createMockRpc(summaryByAddress: Record<string, Record<string, unknown>>) {
  return {
    async call(method: string, params: Record<string, unknown>) {
      if (method !== "get_wallet_summary") {
        throw new Error(`unexpected rpc.call method: ${method}`);
      }
      const address = String(params.address);
      const summary = summaryByAddress[address];
      if (!summary) {
        throw new Error(`no mocked summary for ${address}`);
      }
      return summary;
    },
    async callSendTransaction() {
      throw new Error("unexpected callSendTransaction");
    },
  };
}

function normalizeRecord(record: TestAccountRecord): AccountRecord {
  return {
    ceraAddress: record.ceraAddress,
    accountType: record.accountType ?? "legacy_ed25519",
    authMode: record.authMode ?? "single",
    ed25519PublicKey: record.ed25519PublicKey ?? null,
    pqPublicKey: record.pqPublicKey ?? null,
    pqKeyId: record.pqKeyId ?? "pq-primary",
    keyMaterialRef: record.keyMaterialRef ?? null,
    pqKeyMaterialRef: record.pqKeyMaterialRef ?? null,
    migrationVersion: record.migrationVersion ?? 1,
    derivationScheme: record.derivationScheme ?? null,
    derivationPath: record.derivationPath ?? null,
    coinType: record.coinType ?? null,
    accountIndex: record.accountIndex ?? null,
    addressIndex: record.addressIndex ?? null,
    createdAt: record.createdAt ?? new Date(),
    updatedAt: record.updatedAt ?? new Date(),
  };
}

function createAccountRepositoryMock(initial: TestAccountRecord[] = []) {
  const store = new Map<string, AccountRecord>();
  for (const item of initial) {
    store.set(item.ceraAddress, normalizeRecord(item));
  }

  const repository: AccountRepository = {
    async findByAddress(ceraAddress) {
      return store.get(ceraAddress) ?? null;
    },

    async upsertByAddress(input) {
      const existing = store.get(input.ceraAddress);
      const next = normalizeRecord({
        ...input,
        createdAt: existing?.createdAt ?? new Date(),
        updatedAt: new Date(),
      });
      store.set(next.ceraAddress, next);
      return next;
    },

    async updateHybridMigration(input) {
      const existing = store.get(input.ceraAddress);
      if (!existing) {
        throw new Error("account not found");
      }
      const next: AccountRecord = {
        ...existing,
        accountType: input.accountType,
        authMode: input.authMode,
        pqPublicKey: input.pqPublicKey,
        pqKeyMaterialRef: input.pqKeyMaterialRef ?? null,
        pqKeyId: input.pqKeyId,
        migrationVersion: input.migrationVersion,
        updatedAt: new Date(),
      };
      store.set(next.ceraAddress, next);
      return next;
    },
  };

  return {
    store,
    repository,
  };
}

test("registerAccount stores hybrid-ready account metadata", async () => {
  const mock = createAccountRepositoryMock();
  const service = createAccountService(
    createMockRpc({}) as never,
    { repository: mock.repository }
  );

  const account = await service.registerAccount({
    ceraAddress: " 0xabc123 ",
    accountType: "legacy_ed25519",
    authMode: "single",
    keyMaterialRef: "kms:ed25519:1",
    pqKeyMaterialRef: "kms:mldsa:1",
    pqPublicKey: "0x55",
    pqKeyId: "pq-primary",
  });

  assert.equal(account?.ceraAddress, "0xabc123");
  assert.equal(account?.pqKeyMaterialRef, "kms:mldsa:1");
  assert.equal(account?.pqPublicKey, "0x55");
  assert.equal(account?.pqKeyId, "pq-primary");
});

test("createWallet returns private key once and stores public metadata", async () => {
  const mock = createAccountRepositoryMock();
  const service = createAccountService(
    createMockRpc({}) as never,
    { repository: mock.repository }
  );

  const result = await service.createWallet();

  assert.match(result.privateKey, /^0x[0-9a-f]{64}$/);
  assert.match(result.publicKey, /^0x[0-9a-f]{64}$/);
  assert.equal(result.address, result.publicKey);
  assert.equal(result.privateKeyReturnedOnce, true);
  assert.equal(result.account?.ceraAddress, result.address);
  assert.equal(result.account?.ed25519PublicKey, result.publicKey);
  assert.equal(result.account?.keyMaterialRef, "client-held:ed25519");

  const stored = mock.store.get(result.address);
  assert.equal(stored?.ceraAddress, result.address);
  assert.equal("privateKey" in (stored as Record<string, unknown>), false);
});

test("importPrivateKeyWallet derives address and stores account metadata", async () => {
  const mock = createAccountRepositoryMock();
  const service = createAccountService(
    createMockRpc({}) as never,
    { repository: mock.repository }
  );
  const privateKey = "11".repeat(32);
  const expectedAddress = addressHexFromSeed(seedFromHex64(privateKey));

  const result = await service.importPrivateKeyWallet({
    privateKey: `0x${privateKey}`,
  });

  assert.equal(result.address, expectedAddress);
  assert.equal(result.publicKey, expectedAddress);
  assert.equal(result.account?.ceraAddress, expectedAddress);
  assert.equal(result.account?.ed25519PublicKey, expectedAddress);
  assert.equal(result.account?.keyMaterialRef, "client-held:ed25519");
});

test("createMnemonicWallet returns a 24-word mnemonic and stores derivation metadata", async () => {
  const mock = createAccountRepositoryMock();
  const service = createAccountService(
    createMockRpc({}) as never,
    { repository: mock.repository }
  );

  const result = await service.createMnemonicWallet();

  assert.equal(result.mnemonic.split(" ").length, 24);
  assert.match(result.privateKey, /^0x[0-9a-f]{64}$/);
  assert.equal(result.mnemonicWordCount, 24);
  assert.equal(result.derivationScheme, "cera-mnemonic-v1");
  assert.equal(result.derivationPath, "m/44'/68291'/0'/0'/0'");
  assert.equal(result.secretsReturnedOnce, true);
  assert.equal(result.account?.derivationScheme, "cera-mnemonic-v1");
  assert.equal(result.account?.derivationPath, "m/44'/68291'/0'/0'/0'");
  assert.equal(result.account?.coinType, 68291);
  assert.equal(result.account?.keyMaterialRef, "client-held:bip39");
});

test("importMnemonicWallet derives the same address as created mnemonic", async () => {
  const mock = createAccountRepositoryMock();
  const service = createAccountService(
    createMockRpc({}) as never,
    { repository: mock.repository }
  );

  const created = await service.createMnemonicWallet();
  const imported = await service.importMnemonicWallet({
    mnemonic: created.mnemonic,
  });

  assert.equal(imported.address, created.address);
  assert.equal(imported.publicKey, created.publicKey);
  assert.equal(imported.derivationScheme, "cera-mnemonic-v1");
  assert.equal(imported.derivationPath, "m/44'/68291'/0'/0'/0'");
  assert.equal(imported.account?.derivationPath, "m/44'/68291'/0'/0'/0'");
});

test("getAccountProfile returns local account plus chain summary", async () => {
  const address = "0xfeed";
  const mock = createAccountRepositoryMock([
    {
      ceraAddress: address,
      accountType: "legacy_ed25519",
      authMode: "single",
      migrationVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  const service = createAccountService(
    createMockRpc({
      [address]: {
        address,
        balance: "100",
        pending_out: "0",
        pending_in: "0",
        available: "100",
        locked_balance: "0",
        nonce: 1,
        next_nonce: 2,
        chain_nonce: 1,
        pending_max_nonce: 1,
        block_height: 10,
        account_auth_mode: "single",
        account_type: "legacy_ed25519",
        account_key_count: 1,
        pq_key_count: 0,
      },
    }) as never,
    { repository: mock.repository }
  );

  const result = await service.getAccountProfile({ ceraAddress: address });

  assert.equal(result.account?.ceraAddress, address);
  assert.equal(result.chainSummary?.address, address);
  assert.equal(result.chainSummary?.account_type, "legacy_ed25519");
  assert.equal(result.postQuantumStatus.chain_hybrid_active, false);
  assert.equal(
    result.postQuantumStatus.recommended_next_step,
    "register pq key material locally before migration"
  );
  assert.equal(result.postQuantumStatus.ui_banner_level, "info");
});

test("prepareHybridMigration upgrades stored account to hybrid mode", async () => {
  const address = "0xhybrid";
  const createdAt = new Date();
  const mock = createAccountRepositoryMock([
    {
      ceraAddress: address,
      accountType: "legacy_ed25519",
      authMode: "single",
      migrationVersion: 1,
      createdAt,
      updatedAt: createdAt,
    },
  ]);
  const service = createAccountService(
    createMockRpc({
      [address]: {
        address,
        balance: "200",
        pending_out: "0",
        pending_in: "0",
        available: "200",
        locked_balance: "0",
        nonce: 2,
        next_nonce: 3,
        chain_nonce: 2,
        pending_max_nonce: 2,
        block_height: 11,
        account_auth_mode: "hybrid",
        account_type: "hybrid_ed25519_mldsa",
        account_key_count: 2,
        pq_key_count: 1,
      },
    }) as never,
    { repository: mock.repository }
  );

  const result = await service.prepareHybridMigration({
    ceraAddress: address,
    pqPublicKey: "0x99",
    pqKeyMaterialRef: "kms:mldsa:prepared",
  });

  assert.equal(result.account?.accountType, "hybrid_ed25519_mldsa");
  assert.equal(result.account?.authMode, "hybrid");
  assert.equal(result.account?.pqPublicKey, "0x99");
  assert.equal(result.account?.pqKeyMaterialRef, "kms:mldsa:prepared");
  assert.equal(result.account?.migrationVersion, 2);
  assert.equal(result.chainSummary.account_type, "hybrid_ed25519_mldsa");
  assert.equal(result.migration.prepared, true);
  assert.equal(result.postQuantumStatus.migration_confirmed_on_chain, true);
  assert.equal(result.postQuantumStatus.chain_hybrid_active, true);
  assert.equal(result.postQuantumStatus.ui_banner_level, "success");
});

test("getPostQuantumReadiness reports local-ready but on-chain-pending migration state", async () => {
  const address = "0xprep";
  const createdAt = new Date();
  const mock = createAccountRepositoryMock([
    {
      ceraAddress: address,
      accountType: "hybrid_ed25519_mldsa",
      authMode: "hybrid",
      pqPublicKey: "0xpq",
      pqKeyId: "pq-primary",
      migrationVersion: 2,
      createdAt,
      updatedAt: createdAt,
    },
  ]);
  const service = createAccountService(
    createMockRpc({
      [address]: {
        address,
        balance: "200",
        pending_out: "0",
        pending_in: "0",
        available: "200",
        locked_balance: "0",
        nonce: 2,
        next_nonce: 3,
        chain_nonce: 2,
        pending_max_nonce: 2,
        block_height: 11,
        account_auth_mode: "single",
        account_type: "legacy_ed25519",
        account_key_count: 1,
        pq_key_count: 0,
      },
    }) as never,
    { repository: mock.repository }
  );

  const result = await service.getPostQuantumReadiness({ ceraAddress: address });

  assert.equal(result.postQuantumStatus.local_pq_ready, true);
  assert.equal(result.postQuantumStatus.migration_prepared_locally, true);
  assert.equal(result.postQuantumStatus.migration_confirmed_on_chain, false);
  assert.equal(
    result.postQuantumStatus.recommended_next_step,
    "submit on-chain hybrid migration transaction"
  );
  assert.equal(result.postQuantumStatus.ui_banner_level, "warning");
});

