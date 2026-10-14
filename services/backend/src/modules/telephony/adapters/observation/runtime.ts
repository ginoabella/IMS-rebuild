import { readFileSync, statSync } from 'node:fs';
import { FilePbxCatalog } from '../connectivity/catalog';
import { SecretFileCredentials } from '../connectivity/secret-files';
import { ExactPbxDestinationPolicy } from '../connectivity/destination';
import { ObservationRepository } from '../db/observation-repository';
import { ObservationEngine } from '../../application/observation-engine';
import { observationSettings } from '../../domain/observation-settings';
import { AmiObservationAdapter } from './ami-adapter';
export class TelephonyObservationRuntime {
  private readonly store: ObservationRepository;
  private readonly engine: ObservationEngine;
  constructor(url: string, catalogFile: string, configurationFile: string) {
    const settings = observationSettings();
    let files: Map<string, string>, trust: string;
    try {
      const stat = statSync(configurationFile);
      if (
        !stat.isFile() ||
        stat.size > 4096 ||
        (stat.mode & 0o077) !== 0 ||
        stat.uid !== process.getuid?.()
      )
        throw new Error();
      const input: unknown = JSON.parse(
        readFileSync(configurationFile, 'utf8'),
      );
      if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new Error();
      const data = input as Record<string, unknown>;
      if (
        Object.keys(data).some(
          (k) => !['credentials', 'trustFile'].includes(k),
        ) ||
        typeof data.trustFile !== 'string' ||
        !data.credentials ||
        typeof data.credentials !== 'object' ||
        Array.isArray(data.credentials)
      )
        throw new Error();
      const entries = Object.entries(data.credentials);
      if (
        entries.length < 1 ||
        entries.length > 100 ||
        entries.some(
          ([a, p]) =>
            !/^([a-z0-9][a-z0-9-]{0,63})$/.test(a) ||
            typeof p !== 'string' ||
            !p.startsWith('/') ||
            p.length > 512 ||
            p.includes('\0'),
        )
      )
        throw new Error();
      if (
        !data.trustFile.startsWith('/') ||
        data.trustFile.length > 512 ||
        data.trustFile.includes('\0')
      )
        throw new Error();
      files = new Map(entries as [string, string][]);
      trust = data.trustFile;
    } catch {
      throw new Error('PBX observation configuration unavailable');
    }
    const catalog = new FilePbxCatalog(catalogFile);
    const adapter = new AmiObservationAdapter(
      new SecretFileCredentials(files),
      new ExactPbxDestinationPolicy(catalog, undefined, settings.ioMs),
      trust,
      settings,
    );
    this.store = new ObservationRepository(url, settings);
    this.engine = new ObservationEngine(this.store, catalog, adapter, settings);
  }
  async start() {
    await this.engine.start();
  }
  async stop() {
    await this.engine.stop();
    await this.store.close();
  }
}
