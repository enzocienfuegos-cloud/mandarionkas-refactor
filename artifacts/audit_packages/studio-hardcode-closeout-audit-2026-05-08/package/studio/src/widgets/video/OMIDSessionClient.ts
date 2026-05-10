// apps/studio/src/widgets/video/OMIDSessionClient.ts
//
// S48: OMID (Open Measurement) session client stub for the VASTVideoWidget.
//
// OMID allows third-party measurement vendors (IAS, DoubleVerify, MOAT, etc.)
// to independently verify ad viewability and events without relying exclusively
// on the publisher's own tracking pixels.
//
// The IAB OM SDK works like this:
//   1. The publisher loads the OM SDK script on the page.
//   2. The ad creative loads its vendor-specific verification JS (from <AdVerifications>).
//   3. The publisher creates an OmidSession, registers events, and calls start().
//   4. As the video plays, the publisher fires onEvent() for each VAST event.
//   5. The SDK relays events to all registered verification vendors.
//
// This implementation:
//   - Checks if window.OmidSessionClient is available (loaded externally).
//   - If available, creates a session and relays the standard VAST events.
//   - If not available, logs a warning and does nothing — OMID is optional.
//   - Never blocks VAST playback. OMID failure is always non-fatal.
//
// To fully enable OMID in production:
//   1. Load the IAB OM SDK on the page (via script tag or npm package).
//   2. Ensure ad_tags.omid_verification_js_url is populated for tags that
//      require measurement verification.
//   3. The VAST XML will automatically include <AdVerifications> (S48 backend).
//   4. This client will pick up the OmidSessionClient from window.OmidSessionClient.
//
// Reference: https://iabtechlab.com/standards/open-measurement-sdk/

// ─── Types (minimal subset of the IAB OM SDK API) ─────────────────────────────

interface OmidSessionClientInterface {
  new(partner: OmidPartnerInterface, context: OmidAdSessionContextInterface): OmidSessionClientInterface;
  start(): void;
  finish(): void;
  sendOneWayMessage(event: string, data?: unknown): void;
}

interface OmidAdSessionContextInterface {
  new(omidJsServiceUrl: string, resources: OmidVerificationResource[]): OmidAdSessionContextInterface;
}

interface OmidPartnerInterface {
  new(name: string, version: string): OmidPartnerInterface;
}

interface OmidVerificationResource {
  resourceUrl: string;
  vendorKey?: string;
  verificationParameters?: string;
}

declare global {
  interface Window {
    OmidSessionClient?: OmidSessionClientInterface;
    OmidAdSessionContext?: OmidAdSessionContextInterface;
    OmidPartner?: OmidPartnerInterface;
  }
}

// ─── OMIDSession ───────────────────────────────────────────────────────────────

export interface OMIDVerificationConfig {
  /** URL from VAST <JavaScriptResource> */
  jsUrl: string;
  /** Vendor name from VAST <Verification vendor="..."> */
  vendor?: string;
  /** Opaque params from VAST <VerificationParameters> */
  params?: string;
}

/**
 * Thin wrapper around the IAB OM SDK session.
 * Instantiate once per ad, call start() when playback begins,
 * call the event methods as the video progresses, call finish() on complete/skip.
 *
 * All methods are safe to call even if the OM SDK is not loaded — they no-op.
 */
export class OMIDSession {
  private session: OmidSessionClientInterface | null = null;
  private readonly config: OMIDVerificationConfig;
  private started = false;

  constructor(config: OMIDVerificationConfig) {
    this.config = config;
    this.init();
  }

  private init(): void {
    try {
      const { OmidSessionClient, OmidAdSessionContext, OmidPartner } = window;

      if (!OmidSessionClient || !OmidAdSessionContext || !OmidPartner) {
        // OM SDK not loaded — OMID is optional.
        return;
      }

      const partner = new OmidPartner('SMXStudio', '1.0.0');
      const resources: OmidVerificationResource[] = [{
        resourceUrl: this.config.jsUrl,
        vendorKey:   this.config.vendor,
        verificationParameters: this.config.params,
      }];

      const context = new OmidAdSessionContext(this.config.jsUrl, resources);
      this.session = new OmidSessionClient(partner, context);
    } catch (error) {
      // Never block playback for OMID errors.
      console.warn('[SMX OMID] Session init failed:', error instanceof Error ? error.message : error);
    }
  }

  /** Call when the video starts playing (after the first frame renders). */
  start(): void {
    if (!this.session || this.started) return;
    try {
      this.session.start();
      this.started = true;
    } catch (e) {
      console.warn('[SMX OMID] start() failed:', e);
    }
  }

  /** Call on video complete or skip. */
  finish(): void {
    if (!this.session) return;
    try {
      this.session.finish();
    } catch (e) {
      console.warn('[SMX OMID] finish() failed:', e);
    } finally {
      this.session = null;
    }
  }

  /** Relay a VAST tracking event to all measurement vendors. */
  sendEvent(event: string, data?: Record<string, unknown>): void {
    if (!this.session || !this.started) return;
    try {
      this.session.sendOneWayMessage(event, data);
    } catch (e) {
      console.warn('[SMX OMID] sendEvent() failed:', event, e);
    }
  }

  /** Whether the OM SDK is available and the session was created. */
  get isActive(): boolean {
    return this.session !== null;
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create an OMIDSession from a parsed VAST ad's AdVerifications data.
 * Returns null if no verification JS URL is provided.
 *
 * @param jsUrl   - URL from VAST <JavaScriptResource>
 * @param vendor  - vendor attribute from VAST <Verification>
 * @param params  - content of VAST <VerificationParameters>
 */
export function createOMIDSession(
  jsUrl?: string | null,
  vendor?: string | null,
  params?: string | null,
): OMIDSession | null {
  const url = (jsUrl ?? '').trim();
  if (!url) return null;
  return new OMIDSession({ jsUrl: url, vendor: vendor ?? undefined, params: params ?? undefined });
}
