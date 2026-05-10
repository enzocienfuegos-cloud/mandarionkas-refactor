-- Migration 0025: OMID Verification — ad_tags fields
--
-- S48 adds Open Measurement (OMID) support to VAST delivery.
-- OMID lets third-party measurement vendors verify ad viewability and
-- events independently, without relying on the publisher's pixel firing.
--
-- Fields added to ad_tags:
--   omid_verification_vendor:    Vendor name (e.g. 'IAS', 'DoubleVerify')
--   omid_verification_js_url:    URL to the OMID verification JS bundle
--   omid_verification_params:    Opaque params string passed to the vendor
--
-- These fields are optional. When omid_verification_js_url is set,
-- buildInlineXml (packages/db/src/vast.mjs) includes an <AdVerifications>
-- extension block in the VAST XML.
--
-- IAB OMID spec reference:
--   https://interactiveadverticementsburea.org/what-we-do/industry-initiatives/measurement-addressability-data/om-sdk/

ALTER TABLE ad_tags
  ADD COLUMN IF NOT EXISTS omid_verification_vendor  TEXT,
  ADD COLUMN IF NOT EXISTS omid_verification_js_url  TEXT,
  ADD COLUMN IF NOT EXISTS omid_verification_params  TEXT;

-- Comment for documentation
COMMENT ON COLUMN ad_tags.omid_verification_vendor IS
  'OMID: Measurement vendor name (e.g. IAS, DoubleVerify, MOAT). Informational only.';

COMMENT ON COLUMN ad_tags.omid_verification_js_url IS
  'OMID: URL to the vendor verification JS resource. When set, the VAST XML includes an AdVerifications block.';

COMMENT ON COLUMN ad_tags.omid_verification_params IS
  'OMID: Vendor-specific parameters string passed inside the VerificationParameters element.';
