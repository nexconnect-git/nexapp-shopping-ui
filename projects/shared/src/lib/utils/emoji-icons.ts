const EMOJI_ICON_MAP: Record<string, string> = {
  account_balance: '🏦',
  account_balance_wallet: '💰',
  add: '➕',
  add_a_photo: '📷',
  add_card: '💳',
  add_circle: '➕',
  add_photo_alternate: '🖼️',
  admin_panel_settings: '🛡️',
  alternate_email: '✉️',
  analytics: '📊',
  approval: '✅',
  apps: '📱',
  arrow_back: '←',
  arrow_forward: '→',
  arrow_forward_ios: '›',
  attach_money: '💸',
  auto_awesome: '✨',
  badge: '🪪',
  bar_chart: '📊',
  block: '🚫',
  bolt: '⚡',
  calculate: '🧮',
  calendar_month: '📅',
  calendar_today: '📅',
  campaign: '📣',
  cancel: '✖️',
  category: '🗂️',
  check: '✓',
  check_circle: '✅',
  checklist: '✅',
  chevron_left: '‹',
  chevron_right: '›',
  close: '✕',
  confirmation_number: '🎟️',
  content_copy: '📋',
  conversion_path: '〰️',
  create_new_folder: '📁',
  credit_card: '💳',
  dashboard: '📊',
  data_object: '{}',
  date_range: '📅',
  delete: '🗑️',
  delete_outline: '🗑️',
  delivery_dining: '🛵',
  directions_bike: '🚲',
  done_all: '✅',
  download: '↓',
  edit: '✏️',
  edit_note: '📝',
  email: '✉️',
  error: '⚠️',
  error_outline: '⚠️',
  event: '📅',
  event_available: '📅',
  event_repeat: '↻',
  expand_more: '⌄',
  fact_check: '✅',
  fiber_new: '✨',
  file_download: '↓',
  filter_alt: '🔎',
  filter_list: '🔎',
  first_page: '«',
  flag: '🚩',
  folder: '📁',
  gavel: '⚖️',
  gps_fixed: '📍',
  gps_off: '📍',
  group: '👥',
  groups: '👥',
  handyman: '🧰',
  health_and_safety: '🛡️',
  history: '🕒',
  hourglass_empty: '⌛',
  hourglass_top: '⏳',
  how_to_reg: '✅',
  hub: '🔗',
  image: '🖼️',
  image_not_supported: '🖼️',
  info: 'ℹ️',
  insights: '📈',
  inventory: '📦',
  inventory_2: '📦',
  keyboard_arrow_down: '⌄',
  last_page: '»',
  list_alt: '📋',
  local_activity: '🏷️',
  local_fire_department: '🔥',
  local_offer: '🏷️',
  local_shipping: '🚚',
  location_off: '📍',
  location_on: '📍',
  lock: '🔒',
  lock_clock: '🔐',
  lock_open: '🔓',
  lock_outline: '🔒',
  lock_reset: '🔐',
  login: '→',
  logout: '↩',
  loyalty: '✨',
  manage_accounts: '👤',
  manage_search: '🔎',
  map: '🗺️',
  mark_unread_chat_alt: '💬',
  menu: '☰',
  monitoring: '📊',
  my_location: '📍',
  navigation: '🧭',
  near_me: '📍',
  notes: '📝',
  notifications: '🔔',
  notifications_active: '🔔',
  notifications_none: '🔔',
  open_in_new: '↗',
  pause_circle: '⏸',
  payment: '💳',
  payments: '💸',
  pending_actions: '⏳',
  people: '👥',
  percent: '%',
  person: '👤',
  person_add: '👤',
  person_outline: '👤',
  phone: '📞',
  photo_camera: '📷',
  pin: '📌',
  place: '📍',
  play_circle: '▶',
  playlist_add: '📋',
  playlist_add_check: '✅',
  print: '🖨️',
  priority_high: '!',
  qr_code_2: '▦',
  radar: '📡',
  rate_review: '⭐',
  radio_button_unchecked: '○',
  receipt: '🧾',
  receipt_long: '🧾',
  redeem: '🎁',
  refresh: '↻',
  remove: '−',
  remove_circle: '−',
  report: '📝',
  report_problem: '⚠️',
  request_quote: '🧾',
  restart_alt: '↻',
  replay: '↻',
  restaurant: '🍽️',
  restore: '↻',
  reviews: '⭐',
  room_service: '🛎️',
  route: '〰️',
  rule: '✅',
  save: '💾',
  schedule: '🕒',
  search: '🔎',
  search_off: '🔎',
  send: '✈️',
  send_money: '💸',
  settings: '⚙️',
  shopping_bag: '🛍️',
  shopping_cart: '🛒',
  signal_wifi_off: '📶',
  space_dashboard: '▦',
  speed: '⚡',
  star: '⭐',
  star_rate: '⭐',
  stars: '✨',
  storefront: '🏪',
  store: '🏪',
  support_agent: '🎧',
  sync: '↻',
  task_alt: '✅',
  timeline: '📍',
  timer: '⏱️',
  timer_off: '⏱️',
  tips_and_updates: '💡',
  trending_up: '📈',
  tune: '🎛️',
  two_wheeler: '🛵',
  verified: '✅',
  verified_user: '🛡️',
  visibility: '👁️',
  visibility_off: '🙈',
  view_carousel: '▦',
  view_kanban: '▦',
  warning: '⚠️',
  zoom_in: '🔍',
};

const ICON_SELECTOR =
  '.material-icons-outlined, .material-symbols-rounded, .fd-icon';

export function emojiForIcon(iconName: string): string {
  return EMOJI_ICON_MAP[iconName.trim()] || iconName;
}

function applyEmojiIcon(el: Element): void {
  const rawIconName = (el.textContent || '').trim();
  if (!rawIconName) return;

  const emoji = emojiForIcon(rawIconName);
  if (emoji === rawIconName && el.classList.contains('nc-emoji-icon')) return;
  if (emoji === rawIconName && !EMOJI_ICON_MAP[rawIconName]) return;

  el.setAttribute('data-nc-icon', rawIconName);
  el.setAttribute('aria-hidden', el.getAttribute('aria-hidden') || 'true');
  el.classList.add('nc-emoji-icon');
  el.textContent = emoji;
}

function applyEmojiIcons(root: ParentNode = document): void {
  root.querySelectorAll(ICON_SELECTOR).forEach(applyEmojiIcon);
}

export function installEmojiIconSystem(): void {
  if (
    typeof document === 'undefined' ||
    typeof MutationObserver === 'undefined'
  )
    return;

  const start = () => {
    applyEmojiIcons();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          const parent = mutation.target.parentElement;
          if (parent?.matches(ICON_SELECTOR)) applyEmojiIcon(parent);
          continue;
        }

        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(ICON_SELECTOR)) applyEmojiIcon(node);
          applyEmojiIcons(node);
        });

        if (
          mutation.target instanceof Element &&
          mutation.target.matches(ICON_SELECTOR)
        ) {
          applyEmojiIcon(mutation.target);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
