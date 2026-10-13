import type { Locale } from "./prefs-shared";

const en = {
  "nav.home": "Home",
  "nav.browse": "Browse",
  "nav.schedule": "Schedule",
  "nav.season": "Seasonal",
  "nav.charts": "Charts",
  "nav.library": "Library",
  "nav.account": "Account",
  "nav.feed": "Feed",
  "nav.together": "Together",
  "nav.community": "Community",
  "search.placeholder": "Search",
  "search.recent": "Recently viewed",
  "search.clear": "Clear",
  "search.seeAll": "See all results",
  "menu.overview": "Overview",
  "menu.list": "My list",
  "menu.history": "Watch history",
  "menu.favorites": "Favorites",
  "menu.stats": "Stats",
  "menu.lists": "Custom lists",
  "menu.notifications": "Notifications",
  "menu.profile": "Public profile",
  "menu.settings": "Settings",
  "menu.admin": "Admin",
  "menu.logout": "Log out",
  "menu.login": "Log in",
  "menu.register": "Create account",
  "footer.data": "Data from",
  "footer.skip": "Skip times from",
  "footer.shortcuts": "Keyboard shortcuts",
  "home.continue": "Continue watching",
  "home.upNext": "Up next",
  "home.trending": "Trending now",
  "home.season": "Popular this season",
  "home.top": "Top rated",
  "home.popular": "All-time popular",
  "home.because": "Because you watched",
  "home.finish": "Finish what you started",
  "home.history": "History",
  "home.schedule": "Schedule",
  "common.seeAll": "See all",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.undo": "Undo",
  "common.surprise": "Surprise me",
  "common.addToList": "Add to list",
  "browse.title": "Browse",
  "browse.search": "Search titles",
  "browse.filters": "Filters",
  "browse.genres": "Genres",
  "browse.tags": "Tags",
  "browse.excludeTags": "Exclude tags",
  "browse.format": "Format",
  "browse.status": "Status",
  "browse.season": "Season",
  "browse.year": "Year",
  "browse.length": "Length",
  "browse.duration": "Episode length",
  "browse.minScore": "Minimum score",
  "browse.vibes": "Vibes",
  "browse.clearAll": "Clear all",
  "browse.loadMore": "Load more",
  "browse.savePreset": "Save view",
  "browse.presets": "Saved views",
  "notif.title": "Notifications",
  "notif.markAll": "Mark all as read",
  "notif.empty": "You're all caught up.",
  "palette.placeholder": "Search anime, pages and actions…",
  "account.memberSince": "Member since",
} as const;

export type MessageKey = keyof typeof en;
type Dict = Partial<Record<MessageKey, string>>;

const es: Dict = {
  "nav.home": "Inicio", "nav.browse": "Explorar", "nav.schedule": "Horario", "nav.season": "Temporada", "nav.charts": "Rankings", "nav.library": "Biblioteca", "nav.account": "Cuenta", "nav.feed": "Feed", "nav.together": "Juntos",
  "search.placeholder": "Buscar", "search.recent": "Vistos recientemente", "search.clear": "Borrar", "search.seeAll": "Ver todos los resultados",
  "menu.overview": "Resumen", "menu.list": "Mi lista", "menu.history": "Historial", "menu.favorites": "Favoritos", "menu.stats": "Estadísticas", "menu.lists": "Listas", "menu.notifications": "Notificaciones", "menu.profile": "Perfil público", "menu.settings": "Ajustes", "menu.admin": "Admin", "menu.logout": "Cerrar sesión", "menu.login": "Iniciar sesión", "menu.register": "Crear cuenta",
  "footer.data": "Datos de", "footer.skip": "Tiempos de salto de", "footer.shortcuts": "Atajos de teclado",
  "home.continue": "Seguir viendo", "home.upNext": "Próximamente", "home.trending": "Tendencias", "home.season": "Populares esta temporada", "home.top": "Mejor valorados", "home.popular": "Populares de siempre", "home.because": "Porque viste", "home.finish": "Termina lo que empezaste", "home.history": "Historial", "home.schedule": "Horario",
  "common.seeAll": "Ver todo", "common.save": "Guardar", "common.cancel": "Cancelar", "common.delete": "Eliminar", "common.undo": "Deshacer", "common.surprise": "Sorpréndeme", "common.addToList": "Añadir a la lista",
  "browse.title": "Explorar", "browse.search": "Buscar títulos", "browse.filters": "Filtros", "browse.genres": "Géneros", "browse.tags": "Etiquetas", "browse.excludeTags": "Excluir etiquetas", "browse.format": "Formato", "browse.status": "Estado", "browse.season": "Temporada", "browse.year": "Año", "browse.length": "Duración", "browse.duration": "Duración del episodio", "browse.minScore": "Puntuación mínima", "browse.vibes": "Ambiente", "browse.clearAll": "Borrar todo", "browse.loadMore": "Cargar más", "browse.savePreset": "Guardar vista", "browse.presets": "Vistas guardadas",
  "notif.title": "Notificaciones", "notif.markAll": "Marcar todo como leído", "notif.empty": "Estás al día.", "palette.placeholder": "Busca anime, páginas y acciones…", "account.memberSince": "Miembro desde",
};

const fr: Dict = {
  "nav.home": "Accueil", "nav.browse": "Explorer", "nav.schedule": "Planning", "nav.season": "Saison", "nav.charts": "Classements", "nav.library": "Bibliothèque", "nav.account": "Compte", "nav.feed": "Fil", "nav.together": "Ensemble",
  "search.placeholder": "Rechercher", "search.recent": "Vus récemment", "search.clear": "Effacer", "search.seeAll": "Voir tous les résultats",
  "menu.overview": "Aperçu", "menu.list": "Ma liste", "menu.history": "Historique", "menu.favorites": "Favoris", "menu.stats": "Statistiques", "menu.lists": "Listes", "menu.notifications": "Notifications", "menu.profile": "Profil public", "menu.settings": "Paramètres", "menu.admin": "Admin", "menu.logout": "Se déconnecter", "menu.login": "Se connecter", "menu.register": "Créer un compte",
  "footer.data": "Données de", "footer.skip": "Passages de", "footer.shortcuts": "Raccourcis clavier",
  "home.continue": "Reprendre", "home.upNext": "À venir", "home.trending": "Tendances", "home.season": "Populaires cette saison", "home.top": "Mieux notés", "home.popular": "Populaires de tous les temps", "home.because": "Parce que vous avez regardé", "home.finish": "Terminez ce que vous avez commencé", "home.history": "Historique", "home.schedule": "Planning",
  "common.seeAll": "Tout voir", "common.save": "Enregistrer", "common.cancel": "Annuler", "common.delete": "Supprimer", "common.undo": "Annuler", "common.surprise": "Surprends-moi", "common.addToList": "Ajouter à la liste",
  "browse.title": "Explorer", "browse.search": "Rechercher des titres", "browse.filters": "Filtres", "browse.genres": "Genres", "browse.tags": "Tags", "browse.excludeTags": "Exclure des tags", "browse.format": "Format", "browse.status": "Statut", "browse.season": "Saison", "browse.year": "Année", "browse.length": "Longueur", "browse.duration": "Durée d'épisode", "browse.minScore": "Note minimale", "browse.vibes": "Ambiances", "browse.clearAll": "Tout effacer", "browse.loadMore": "Charger plus", "browse.savePreset": "Enregistrer la vue", "browse.presets": "Vues enregistrées",
  "notif.title": "Notifications", "notif.markAll": "Tout marquer comme lu", "notif.empty": "Vous êtes à jour.", "palette.placeholder": "Rechercher anime, pages et actions…", "account.memberSince": "Membre depuis",
};

const de: Dict = {
  "nav.home": "Start", "nav.browse": "Entdecken", "nav.schedule": "Zeitplan", "nav.season": "Saison", "nav.charts": "Charts", "nav.library": "Bibliothek", "nav.account": "Konto", "nav.feed": "Feed", "nav.together": "Zusammen",
  "search.placeholder": "Suchen", "search.recent": "Zuletzt angesehen", "search.clear": "Leeren", "search.seeAll": "Alle Ergebnisse",
  "menu.overview": "Übersicht", "menu.list": "Meine Liste", "menu.history": "Verlauf", "menu.favorites": "Favoriten", "menu.stats": "Statistiken", "menu.lists": "Listen", "menu.notifications": "Benachrichtigungen", "menu.profile": "Öffentliches Profil", "menu.settings": "Einstellungen", "menu.admin": "Admin", "menu.logout": "Abmelden", "menu.login": "Anmelden", "menu.register": "Konto erstellen",
  "footer.data": "Daten von", "footer.skip": "Skip-Zeiten von", "footer.shortcuts": "Tastenkürzel",
  "home.continue": "Weiterschauen", "home.upNext": "Als Nächstes", "home.trending": "Im Trend", "home.season": "Beliebt diese Saison", "home.top": "Bestbewertet", "home.popular": "Beliebteste aller Zeiten", "home.because": "Weil du geschaut hast", "home.finish": "Beende, was du angefangen hast", "home.history": "Verlauf", "home.schedule": "Zeitplan",
  "common.seeAll": "Alle anzeigen", "common.save": "Speichern", "common.cancel": "Abbrechen", "common.delete": "Löschen", "common.undo": "Rückgängig", "common.surprise": "Überrasch mich", "common.addToList": "Zur Liste",
  "browse.title": "Entdecken", "browse.search": "Titel suchen", "browse.filters": "Filter", "browse.genres": "Genres", "browse.tags": "Tags", "browse.excludeTags": "Tags ausschließen", "browse.format": "Format", "browse.status": "Status", "browse.season": "Saison", "browse.year": "Jahr", "browse.length": "Länge", "browse.duration": "Episodenlänge", "browse.minScore": "Mindestbewertung", "browse.vibes": "Stimmungen", "browse.clearAll": "Alle löschen", "browse.loadMore": "Mehr laden", "browse.savePreset": "Ansicht speichern", "browse.presets": "Gespeicherte Ansichten",
  "notif.title": "Benachrichtigungen", "notif.markAll": "Alle als gelesen markieren", "notif.empty": "Du bist auf dem neuesten Stand.", "palette.placeholder": "Anime, Seiten und Aktionen suchen…", "account.memberSince": "Mitglied seit",
};

const ja: Dict = {
  "nav.home": "ホーム", "nav.browse": "探す", "nav.schedule": "放送予定", "nav.season": "今期", "nav.charts": "ランキング", "nav.library": "ライブラリ", "nav.account": "アカウント", "nav.feed": "フィード", "nav.together": "一緒に見る",
  "search.placeholder": "検索", "search.recent": "最近見た作品", "search.clear": "クリア", "search.seeAll": "すべての結果",
  "menu.overview": "概要", "menu.list": "マイリスト", "menu.history": "視聴履歴", "menu.favorites": "お気に入り", "menu.stats": "統計", "menu.lists": "カスタムリスト", "menu.notifications": "通知", "menu.profile": "公開プロフィール", "menu.settings": "設定", "menu.admin": "管理", "menu.logout": "ログアウト", "menu.login": "ログイン", "menu.register": "アカウント作成",
  "footer.data": "データ提供", "footer.skip": "スキップ時間", "footer.shortcuts": "キーボードショートカット",
  "home.continue": "続きを見る", "home.upNext": "次の放送", "home.trending": "トレンド", "home.season": "今期の人気作", "home.top": "高評価", "home.popular": "歴代人気", "home.because": "視聴履歴からのおすすめ", "home.finish": "途中の作品を最後まで", "home.history": "履歴", "home.schedule": "放送予定",
  "common.seeAll": "すべて見る", "common.save": "保存", "common.cancel": "キャンセル", "common.delete": "削除", "common.undo": "元に戻す", "common.surprise": "おまかせ", "common.addToList": "リストに追加",
  "browse.title": "探す", "browse.search": "タイトル検索", "browse.filters": "フィルター", "browse.genres": "ジャンル", "browse.tags": "タグ", "browse.excludeTags": "除外タグ", "browse.format": "形式", "browse.status": "状態", "browse.season": "シーズン", "browse.year": "年", "browse.length": "話数", "browse.duration": "1話の長さ", "browse.minScore": "最低スコア", "browse.vibes": "雰囲気", "browse.clearAll": "すべてクリア", "browse.loadMore": "もっと見る", "browse.savePreset": "表示を保存", "browse.presets": "保存した表示",
  "notif.title": "通知", "notif.markAll": "すべて既読にする", "notif.empty": "新しい通知はありません。", "palette.placeholder": "アニメ・ページ・操作を検索…", "account.memberSince": "登録日",
};

const DICTS: Record<Locale, Dict> = { en, es, fr, de, ja };

export function translator(locale: Locale) {
  const d = DICTS[locale] ?? en;
  return (key: MessageKey) => d[key] ?? en[key];
}

export const LOCALE_NAMES: Record<Locale, string> = { en: "English", es: "Español", fr: "Français", de: "Deutsch", ja: "日本語" };
