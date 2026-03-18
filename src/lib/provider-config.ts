/**
 * Re-export provider config from TSX module.
 * Keeps imports working when consumers use @/lib/provider-config (no extension).
 */
export {
  N8nIcon,
  ZapierIcon,
  MakeIcon,
  AirtableIcon,
  PROVIDER_CONFIG,
  UNKNOWN_PROVIDER_CONFIG,
  getProviderConfig,
  type ProviderConfig,
} from "./provider-config";
