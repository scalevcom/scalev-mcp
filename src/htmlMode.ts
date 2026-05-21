export type HtmlModePayload = {
  html_code?: string;
  css_code?: string;
  js_code?: string;
  csp_policy?: Record<string, string[]>;
};

export type PageListResponse = Record<string, unknown> & {
  data?: Array<Record<string, unknown>>;
};

export type PageDetail = Record<string, unknown> & {
  id?: number;
  store_id?: number | null;
  render_mode?: string | null;
  page_display?: PageDisplay | null;
  current_page_display?: PageDisplay | number | null;
};

export type PageDisplay = Record<string, unknown> & {
  id?: number;
  version?: number;
  render_mode?: string | null;
  html_code?: string | null;
  css_code?: string | null;
  js_code?: string | null;
  csp_policy?: Record<string, string[]> | null;
  meta?: unknown;
  banner?: unknown;
  header?: unknown;
  general?: unknown;
  sidebar?: unknown;
  main?: unknown;
  form_display?: Record<string, unknown> | null;
  is_published?: boolean;
  published_at?: string | null;
};

export function htmlModePagesPath(input: { q?: string; store_id?: number; limit?: number }): string {
  const query = new URLSearchParams();
  if (input.q) query.set("search", input.q);
  if (input.store_id) query.set("store_id", String(input.store_id));
  if (input.limit) query.set("page_size", String(input.limit));

  return `/v3/pages${query.size > 0 ? `?${query.toString()}` : ""}`;
}

export function pagePath(pageId: number): string {
  return `/v3/pages/${pageId}`;
}

export function pageDisplayValidatePath(pageId: number): string {
  return `/v3/pages/${pageId}/page-displays/validate`;
}

export function pageDisplayCreatePath(pageId: number): string {
  return `/v3/pages/${pageId}/page-displays`;
}

export function pageDisplayPath(pageId: number, pageDisplayId: number): string {
  return `/v3/pages/${pageId}/page-displays/${pageDisplayId}`;
}

export function buildHtmlModeDraftPayload(page: PageDetail, payload: HtmlModePayload): Record<string, unknown> {
  const current = pageDisplay(page) || {};
  const draft: Record<string, unknown> = {
    render_mode: "html_mode",
    is_published: false,
    schema_version: current.schema_version || 2,
    meta: current.meta || {},
    banner: current.banner || { type: "no_banner" },
    header: current.header || {},
    general: current.general || defaultHtmlModeGeneral(),
    sidebar: current.sidebar || [],
    main: current.main || [],
    html_code: payload.html_code ?? current.html_code ?? "",
    css_code: payload.css_code ?? current.css_code ?? "",
    js_code: payload.js_code ?? current.js_code ?? "",
    csp_policy: payload.csp_policy ?? current.csp_policy ?? {}
  };

  const formDisplay = buildFormDisplayPayload(page, current.form_display || undefined);
  if (formDisplay) draft.form_display = formDisplay;

  return draft;
}

export function pageDisplay(page: PageDetail): PageDisplay | undefined {
  if (isRecord(page.page_display)) return page.page_display as PageDisplay;
  if (isRecord(page.current_page_display)) return page.current_page_display as PageDisplay;
  return undefined;
}

function buildFormDisplayPayload(
  page: PageDetail,
  formDisplay?: Record<string, unknown>
): Record<string, unknown> | undefined {
  const storeId =
    numericId(formDisplay?.store_id) ||
    numericId((formDisplay?.store as Record<string, unknown> | undefined)?.id) ||
    numericId(page.store_id);
  if (!storeId) return undefined;

  const payload: Record<string, unknown> = { store_id: storeId };
  const copyKeys = [
    "chat_template",
    "text_for_bank_transfer",
    "text_for_cod",
    "text_for_epayment",
    "handler_assignment",
    "after_submit_event",
    "custom_url",
    "custom_phone",
    "is_sending_email_invoice",
    "name_label",
    "name_placeholder",
    "is_name",
    "is_name_required",
    "is_phone",
    "is_phone_required",
    "phone_label",
    "phone_placeholder",
    "email_label",
    "email_placeholder",
    "is_email",
    "is_email_required",
    "address_label",
    "address_placeholder",
    "notes_label",
    "notes_placeholder",
    "items_title",
    "form_title",
    "is_discount_code",
    "discount_code_label",
    "discount_code_placeholder",
    "button_text",
    "button_font_size",
    "button_color",
    "is_button_icon",
    "button_icon",
    "location_type",
    "is_address",
    "is_courier_search",
    "is_courier_shown",
    "courier_label",
    "payment_method_label",
    "is_summary_shown",
    "summary_label",
    "is_notes",
    "is_items_shown",
    "is_items_images_shown",
    "is_multiple_items",
    "is_items_required",
    "is_location_required",
    "is_address_required",
    "is_notes_required",
    "items_type",
    "items_list_type",
    "is_items_price_shown",
    "form_position",
    "is_upsell",
    "upsell_type",
    "upsell_description",
    "upsell_img",
    "is_upsell_img_autoslide",
    "upsell_img_duration",
    "is_price_strike",
    "is_single_product",
    "is_auto_select",
    "onsubmit_fb_events",
    "fb_events_onsubmit_parameters",
    "onsubmit_tiktok_events",
    "tiktok_events_onsubmit_parameters",
    "onsubmit_kwai_client_events",
    "kwai_client_events_onsubmit_parameters",
    "onsubmit_kwai_server_events",
    "kwai_server_events_onsubmit_parameters"
  ];

  for (const key of copyKeys) {
    if (formDisplay && typeof formDisplay[key] !== "undefined") payload[key] = formDisplay[key];
  }

  putNestedId(payload, formDisplay, "store_sales_person", "store_sales_person_id");
  putNestedId(payload, formDisplay, "other_page", "other_page_id");
  putNestedId(payload, formDisplay, "upsell_variant", "upsell_variant_id");
  putNestedId(payload, formDisplay, "upsell_bundle_price_option", "upsell_bundle_price_option_id");

  payload.variant_ids = idsFrom(formDisplay?.variants);
  payload.bundle_price_option_ids = idsFrom(formDisplay?.bundle_price_options);

  return payload;
}

function putNestedId(
  payload: Record<string, unknown>,
  source: Record<string, unknown> | undefined,
  objectKey: string,
  idKey: string
) {
  const id = numericId(source?.[idKey]) || numericId((source?.[objectKey] as Record<string, unknown> | undefined)?.id);
  if (id) payload[idKey] = id;
}

function defaultHtmlModeGeneral() {
  return {
    layoutType: "full",
    containerMaxWidth: "1200px",
    fontSize: "normal",
    backgroundColor: "#F2F5FA",
    pageBackgroundColor: "#FFFFFF",
    sidebarPosition: "no_sidebar",
    hasForm: false
  };
}

function idsFrom(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => numericId(isRecord(item) ? item.id : item)).filter((id): id is number => Boolean(id));
}

function numericId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
