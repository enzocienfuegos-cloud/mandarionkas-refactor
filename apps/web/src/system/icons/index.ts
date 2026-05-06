/**
 * DUSK icon set — curated re-exports from lucide-react.
 *
 * RULE: Every icon used in the app MUST be imported from this file.
 * Direct imports from 'lucide-react' are forbidden by ESLint.
 *
 * This gives us:
 *   1. A single place to swap the icon library if needed
 *   2. Consistent stroke-width / size
 *   3. A clear inventory of every icon the product uses
 *
 * If you need an icon that isn't here, add it to this file.
 * Never use emojis (📊, ⏸, ▶, ■, 🔗) in chrome UI.
 */

export {
  // Navigation
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  CornerDownLeft,
  Compass,
  Code,
  Code2,
  Globe,
  Zap,
  X,
  X as Close,

  // Search & filter
  Search,
  Filter,
  SlidersHorizontal,

  // Status
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  CircleDot,
  CircleCheck,
  CircleAlert,

  // Actions
  Plus,
  Minus,
  Trash2,
  Pencil,
  Copy,
  Download,
  Upload,
  Send,
  ExternalLink,
  Link as LinkIcon,
  MoreHorizontal,
  MoreVertical,
  RefreshCw,
  Save,

  // Playback / state
  Play,
  Pause,
  Square as Stop,
  CircleStop,

  // Domain (adtech)
  BarChart3,
  LineChart,
  PieChart,
  TrendingUp,
  TrendingDown,
  Activity,
  Gauge,
  Target,
  Eye,
  EyeOff,
  MousePointerClick,
  Image as ImageIcon,
  Film,
  Tag,
  Tags,
  Megaphone,
  DollarSign,

  // System
  Settings,
  Settings2,
  FlaskConical,
  Bell,
  Building2,
  LogIn,
  LogOut,
  Webhook,
  KeyRound,
  Shield,
  User,
  Users,
  HelpCircle,
  Sun,
  Moon,
  Monitor,
  Command,
  Keyboard,
  Wrench,

  // Layout
  LayoutDashboard,
  LayoutGrid,
  Table2,
  Columns3,
  Rows3,
  PanelLeft,
  PanelRight,

  // Calendar / time
  Calendar,
  CalendarDays,
  Clock,

  // Files
  FileText,
  FileCode,
  FolderOpen,
  Inbox,
} from 'lucide-react';
