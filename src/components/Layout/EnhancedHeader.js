import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef, useCallback } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  InputBase,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemAvatar,
  Divider,
  Chip,
  Paper,
  MenuList,
  ClickAwayListener,
  Popper,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Button,
  Badge,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  alpha,
} from '@mui/material';
import {
  Search,
  Tune,
  Menu as MenuIcon,
  History,
  ExitToApp,
  Close,
  Landscape,
  Person,
  Message,
  CurrencyExchange,
  Settings,
  Agriculture,
  Receipt,
  Nature,
  AccountBalance,
  Add,
  MonetizationOn,
  ExpandMore,
  ReportProblem,
  Notifications,
  NotificationsActive,
  CheckCircle,
  Info,
  Warning,
  Error as ErrorIcon,
  AccountBalanceWallet,
  CreditCard,
  Home,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import coinService from '../../services/coinService';
import { orderService } from '../../services/orders';
import { getProductIcon } from '../../utils/productIcons';
import supabase from '../../services/supabase';
import { messagingService } from '../../services/messaging';

// Custom hook to detect mobile screens
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
};

// CSS animation styles
const slideDownAnimation = `
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

// Inject the animation styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = slideDownAnimation;
  document.head.appendChild(style);
}

const EnhancedHeader = forwardRef(({
  user,
  onLogout,
  onSearchChange,
  onFilterApply,
  fields = [],
  onFarmSelect,
  farmerCoins = 12500,
  onCreateField,
  onCreateFarm,
  userType = 'farmer',
  onMenuClick,
  backendNotifications = [],
  onMarkNotificationAsRead,
  onRefreshNotifications,
}, ref) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const isAdmin = userType === 'admin';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchAnchorEl, setSearchAnchorEl] = useState(null);
  const [filteredFields, setFilteredFields] = useState([]);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [activeFilters, setActiveFilters] = useState({
    categories: [],
    subcategories: [],
    locations: []
  });
  const [expanded, setExpanded] = useState({});
  const [userCoins, setUserCoins] = useState(0);
  const [pickupReadyCount, setPickupReadyCount] = useState(0);
  const [pickupPanelOpen, setPickupPanelOpen] = useState(false);
  const [pickupReadyList, setPickupReadyList] = useState([]);
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState(null);
  const [coinsMenuAnchorEl, setCoinsMenuAnchorEl] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentChats, setRecentChats] = useState([]);
  const [notifAnchorEl, setNotifAnchorEl] = useState(null);
  const [messagesAnchorEl, setMessagesAnchorEl] = useState(null);
  const [desktopSearchExpanded, setDesktopSearchExpanded] = useState(false);
  const desktopSearchRef = useRef(null);
  const desktopSearchInputRef = useRef(null);

  // Get user-specific coins when user changes
  const loadUserCoins = useCallback(async () => {
    if (user && user.id) {
      try {
        const coins = await coinService.getUserCoins(user.id);
        // Handle 0 coins properly (0 is a valid value, not an error)
        setUserCoins(typeof coins === 'number' ? coins : 0);
      } catch (error) {
        console.error('Error loading user coins:', error);
        setUserCoins(0); // Default fallback to 0 instead of 12500
      }
    } else {
      setUserCoins(0); // Default for logged out users
    }
  }, [user]);

  useEffect(() => {
    loadUserCoins();
  }, [loadUserCoins]);

  useEffect(() => {
    const handler = () => loadUserCoins();
    window.addEventListener('sharecrop-refresh-coins', handler);
    return () => window.removeEventListener('sharecrop-refresh-coins', handler);
  }, [loadUserCoins]);

  // Handle Unread Count and Realtime Notifications
  const fetchUnreadStats = useCallback(async () => {
    if (!user || !user.id) return;
    try {
      const convs = await messagingService.getConversations();
      setRecentChats(convs);
      const total = convs.reduce((sum, c) => sum + (c.unread_count || 0), 0);
      setUnreadCount(total);
    } catch (err) {
      console.error('Error fetching unread stats:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user && user.id) {
      fetchUnreadStats();

      if (supabase) {
        // Subscribe to messages to update unread count
        const msgChannel = supabase
          .channel(`header-notifications-${user.id}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
          }, payload => {
            const newMsg = payload.new;
            // If it's not from us, refresh stats
            if (newMsg.sender_id !== user.id) {
              fetchUnreadStats();
            }
          })
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: 'is_read=eq.true'
          }, () => {
            fetchUnreadStats();
          })
          .subscribe();

        return () => {
          supabase.removeChannel(msgChannel);
        };
      }
    }
  }, [user, fetchUnreadStats]);

  // Expose refresh function to parent components
  useImperativeHandle(ref, () => ({
    refreshCoins: loadUserCoins
  }));

  const handleLogout = () => {
    onLogout();
  };

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleNavigation = (path) => {
    navigate(path);
    setDrawerOpen(false);
  };

  // Filter logic functions
  const canonicalize = (raw) => {
    const s = (raw || '').toString().trim().toLowerCase();
    const slug = s.replace(/[\s_]+/g, '-');
    const compact = slug.replace(/-/g, '');
    const synonyms = {
      greenapple: 'green-apple',
      redapple: 'red-apple',
      lemons: 'lemon',
      lemon: 'lemon',
      tangarine: 'tangerine',
      tangerines: 'tangerine',
      corns: 'corn',
      corn: 'corn',
      strawberries: 'strawberry',
      strawberry: 'strawberry',
      tomatoes: 'tomato',
      tomato: 'tomato',
      eggplants: 'eggplant',
      eggplant: 'eggplant',
      peaches: 'peach',
      peach: 'peach',
      watermelons: 'watermelon',
      watermelon: 'watermelon',
      mangoes: 'mango',
      mango: 'mango',
      avocados: 'avocado',
      avocado: 'avocado',
      grapes: 'grape',
      grape: 'grape',
      bananas: 'banana',
      banana: 'banana'
    };
    const syn = synonyms[compact] || slug;
    return syn.replace(/-/g, ' ');
  };
  const applyFilters = (fieldsToFilter) => {
    let filtered = fieldsToFilter;

    const hasSubs = activeFilters.subcategories.length > 0;
    const hasCats = activeFilters.categories.length > 0;

    if (hasSubs) {
      filtered = filtered.filter(field => {
        const prodRaw = field.subcategory || field.product_name || field.productName || '';
        const sub = canonicalize(prodRaw);
        return activeFilters.subcategories.some(s => {
          const key = canonicalize(s);
          return sub === key || sub.includes(key);
        });
      });
    } else if (hasCats) {
      filtered = filtered.filter(field => {
        const cat = canonicalize(field.category);
        const prodRaw = field.product_name || field.productName || field.subcategory || '';
        const sub = canonicalize(prodRaw);
        return activeFilters.categories.some(category => {
          const c = canonicalize(category);
          return cat === c || sub === c || cat.includes(c) || sub.includes(c);
        });
      });
    }

    return filtered;
  };

  /** Returns true if the field matches the search term against all relevant text/numeric fields */
  const fieldMatchesSearch = (field, searchTerm) => {
    if (!searchTerm || !field) return false;
    const term = searchTerm.toLowerCase();
    const str = (v) => (v != null && v !== '' ? String(v).toLowerCase() : '');
    const match = (v) => str(v).includes(term);
    const fieldsToCheck = [
      field.name,
      field.description,
      field.location,
      field.category,
      field.subcategory,
      field.product_name,
      field.productName,
      field.farmer_name,
      field.farmer,
      field.owner,
      field.farm_name,
      field.farmName,
      field.weather,
      field.unit,
      field.field_size,
      field.field_size_unit,
      field.area_m2,
      field.available_area,
      field.total_area,
      field.price,
      field.price_per_m2,
      field.quantity,
      field.production_rate,
      field.production_rate_unit,
      field.shipping_option,
      field.shipping_scope,
      field.delivery_charges,
    ];
    if (fieldsToCheck.some(match)) return true;
    const harvestDates = Array.isArray(field.harvest_dates) ? field.harvest_dates : Array.isArray(field.harvestDates) ? field.harvestDates : [];
    const harvestStr = harvestDates.map((h) => h?.date || h?.label || '').join(' ');
    if (match(harvestStr)) return true;
    return false;
  };

  /** Splits text by query (case-insensitive) and wraps matches in a highlight span */
  const highlightMatch = (text, query) => {
    if (text == null || text === '') return '';
    const str = String(text);
    if (!query || !String(query).trim()) return str;
    const escaped = String(query).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = str.split(regex);
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <Box
          component="span"
          key={`${i}-${part}`}
          sx={{
            backgroundColor: 'rgba(76, 175, 80, 0.35)',
            borderRadius: 0.5,
            px: 0.25,
            fontWeight: 600,
          }}
        >
          {part}
        </Box>
      ) : (
        part
      )
    );
  };

  const handleFilterApply = () => {
    const filtered = applyFilters(fields);
    setFilteredFields(filtered);
    if (onSearchChange) {
      onSearchChange(searchQuery, filtered);
    }
    if (typeof onFilterApply === 'function') {
      onFilterApply({
        categories: activeFilters.categories.slice(),
        subcategories: activeFilters.subcategories.slice(),
      });
    }
    setFilterAnchorEl(null);
  };

  // const isHarvestToday = (f) => {
  //   const today = new Date();
  //   const toDate = (val) => {
  //     if (!val) return null;
  //     if (typeof val === 'string') {
  //       const s = val.trim();
  //       if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
  //         const d0 = new Date(`${s}T00:00:00`);
  //         if (!isNaN(d0.getTime())) return d0;
  //       }
  //     }
  //     const d = new Date(val);
  //     if (!isNaN(d.getTime())) return d;
  //     const s = String(val);
  //     const parts = s.split(/[-/\s]/);
  //     if (parts.length >= 3) {
  //       const tryStr = `${parts[0]} ${parts[1]} ${parts[2]}`;
  //       const d2 = new Date(tryStr);
  //       if (!isNaN(d2.getTime())) return d2;
  //     }
  //     return null;
  //   };
  //   const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  //   const list = Array.isArray(f?.harvestDates) ? f.harvestDates : Array.isArray(f?.harvest_dates) ? f.harvest_dates : [];
  //   for (const hd of list) {
  //     const d = toDate(hd?.date || hd);
  //     if (sameDay(d, today)) return true;
  //   }
  //   const single = f?.harvest_date || f?.harvestDate;
  //   const d = toDate(single);
  //   return sameDay(d, today);
  // };

  // const hasPickupShipping = (f) => {
  //   const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  //   const list = Array.isArray(f?.shipping_modes) ? f.shipping_modes : [];
  //   const lower = list.map(m => normalize(m));
  //   const single = normalize(f?.shipping_option || f?.mode_of_shipping || f?.shipping_method || '');
  //   const hasArrayInfo = lower.length > 0;
  //   const hasSingleInfo = single.length > 0;
  //   const hasPickupWord = (v) => v.includes('pickup') || v.includes('pick') || v.includes('selfpickup') || v.includes('selfpick');
  //   const hasDeliveryWord = (v) => v.includes('delivery');

  //   if (hasSingleInfo) {
  //     const singleHasPickup = hasPickupWord(single) || single.includes('both');
  //     const singleHasDelivery = hasDeliveryWord(single);
  //     if (singleHasPickup) return true;
  //     if (singleHasDelivery && !singleHasPickup) return false;
  //     return false;
  //   }
  //   if (hasArrayInfo) {
  //     const arrayHasPickup = lower.some(v => hasPickupWord(v) || v.includes('both')) || (lower.some(hasPickupWord) && lower.some(hasDeliveryWord));
  //     const arrayHasDeliveryOnly = lower.some(hasDeliveryWord) && !arrayHasPickup;
  //     if (arrayHasPickup) return true;
  //     if (arrayHasDeliveryOnly) return false;
  //     return false;
  //   }
  //   return f?.shipping_pickup === true;
  // };

  useEffect(() => {
    let mounted = true;
    let timeoutId = null;

    const loadPickupReadyFromOrders = async () => {
      try {
        if (!user || !user.id) {
          if (mounted) {
            setPickupReadyCount(0);
            setPickupReadyList([]);
          }
          return;
        }
        const res = await orderService.getBuyerOrdersWithFields(user.id);
        const orders = Array.isArray(res?.data) ? res.data : (res?.data?.orders || []);
        const byField = new Map();
        orders.forEach((o) => {
          const fid = o.field_id || o.fieldId || o.field?.id;
          if (!fid) return;
          const prev = byField.get(fid) || { created_at: null, selected_harvest_date: null, mode: null, purchased: false, field: o.field };
          const createdAt = o.created_at || o.createdAt || null;
          const prevTs = prev.created_at ? new Date(prev.created_at).getTime() : -Infinity;
          const curTs = createdAt ? new Date(createdAt).getTime() : -Infinity;
          const m = (o.mode_of_shipping || o.shipping_method || '').trim().toLowerCase();
          const canon = m === 'pickup' ? 'Pickup' : (m === 'delivery' ? 'Delivery' : (m ? m : null));
          if (curTs >= prevTs) {
            const purchased = (o.purchased === true)
              || (() => { const q = o.quantity ?? o.area_rented ?? o.area; const v = typeof q === 'string' ? parseFloat(q) : q; return Number.isFinite(v) && v > 0; })()
              || (() => { const s = String(o.status || '').toLowerCase(); return s === 'active' || s === 'pending'; })();
            byField.set(fid, { created_at: createdAt, selected_harvest_date: o.selected_harvest_date || null, mode: canon, purchased, field: o.field });
          }
        });
        const withinGrace = (val, days = 4) => {
          if (!val) return false;
          const today = new Date();
          const d = new Date(val);
          if (isNaN(d.getTime())) return false;
          const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
          const h0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
          const diffDays = Math.round((h0 - t0) / (24 * 60 * 60 * 1000));
          return diffDays <= 0 && diffDays >= -days;
        };
        const getModes = (f, last) => {
          const arr = [];
          if (last?.mode) arr.push(last.mode);
          if (f?.shipping_pickup) arr.push('Pickup');
          if (f?.shipping_delivery) arr.push('Delivery');
          const single = f?.shipping_option || f?.mode_of_shipping || f?.shipping_method || '';
          const s = String(single).trim().toLowerCase();
          if (s === 'pickup') arr.push('Pickup'); else if (s === 'delivery') arr.push('Delivery'); else if (s.includes('both')) arr.push('Delivery');
          const set = new Set();
          return arr.filter(m => { const k = String(m || '').toLowerCase(); if (set.has(k)) return false; set.add(k); return true; });
        };
        // const toDate = (val) => {
        //   if (!val) return null;
        //   if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
        //     const d0 = new Date(`${val}T00:00:00`);
        //     if (!isNaN(d0.getTime())) return d0;
        //   }
        //   const d = new Date(val);
        //   return isNaN(d.getTime()) ? null : d;
        // };
        const ready = Array.isArray(fields) ? fields.filter((f) => {
          const last = byField.get(f.id);
          if (!last) return false;
          if (last.purchased !== true) return false;
          const modes = getModes(f, last).map(m => String(m || '').toLowerCase());
          const mode = modes.includes('pickup') ? 'pickup' : (modes.includes('delivery') ? 'delivery' : null);
          if (mode !== 'pickup') return false;
          return withinGrace(last.selected_harvest_date, 4);
        }) : [];
        if (mounted) {
          setPickupReadyCount(ready.length);
          setPickupReadyList(ready);
        }
      } catch {
        if (mounted) {
          setPickupReadyCount(0);
          setPickupReadyList([]);
        }
      }
    };

    // Debounce the API call - only call if user.id or fields.length changes, and wait 5 seconds
    timeoutId = setTimeout(() => {
      loadPickupReadyFromOrders();
    }, 5000);

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user, fields]); // Only depend on user.id and fields.length, not entire objects

  const handleFilterClear = () => {
    setActiveFilters({ categories: [], subcategories: [], locations: [] });
    setFilteredFields(fields);
    if (onSearchChange) {
      onSearchChange(searchQuery, fields);
    }
    if (typeof onFilterApply === 'function') {
      onFilterApply({ categories: [], subcategories: [] });
    }
  };

  // Menu order matching sidebar image: Home | Rented Fields, My Orders, Profile | My Farms, Farm Orders, License Info, Transaction | Notifications, Messages, Change Currency, Settings
  const getMenuConfig = (userType) => {
    const isFarmer = userType === 'farmer';
    const sections = [
      {
        id: 'home',
        title: '',
        items: [
          { text: 'Home', icon: <Home />, path: '/' },
        ]
      },
      {
        id: 'main',
        title: 'Farms & Fields',
        items: [
          { text: 'My Fields', icon: <Landscape />, path: isFarmer ? '/farmer/rented-fields' : '/buyer/rented-fields' },
          { text: 'My Orders', icon: <History />, path: isFarmer ? '/farmer/orders' : '/buyer/orders' },
          { text: 'Profile', icon: <Person />, path: isFarmer ? '/farmer/profile' : '/buyer/profile' },
        ]
      },
      {
        id: 'farmer',
        title: isFarmer ? 'Farmer' : 'Information',
        items: [
          { text: 'My Farms', icon: <Agriculture />, path: '/farmer/my-farms' },
          { text: 'Farm Orders', icon: <Receipt />, path: '/farmer/farm-orders' },
          { text: 'License Info', icon: <Nature />, path: isFarmer ? '/farmer/license-info' : '/buyer/license-info' },
          { text: 'Transaction', icon: <AccountBalance />, path: isFarmer ? '/farmer/transaction' : '/buyer/transaction' },
        ]
      },
      {
        id: 'settings',
        title: 'Account',
        items: [
          { text: 'Notifications', icon: <Notifications />, path: isFarmer ? '/farmer/notifications' : '/buyer/notifications' },
          { text: 'Messages', icon: <Message />, path: isFarmer ? '/farmer/messages' : '/buyer/messages' },
          { text: 'Change Currency', icon: <CurrencyExchange />, path: isFarmer ? '/farmer/currency' : '/buyer/currency' },
          { text: 'Settings', icon: <Settings />, path: isFarmer ? '/farmer/settings' : '/buyer/settings' },
          { text: 'Complaints', icon: <ReportProblem />, path: isFarmer ? '/farmer/complaints' : '/buyer/complaints' },
        ]
      },
      {
        id: 'wallet',
        title: 'Wallet',
        items: [
          { text: 'Redeem Coins', icon: <AccountBalanceWallet />, path: isFarmer ? '/farmer/redeem-coins' : '/buyer/redeem-coins' },
          { text: 'Redemption History', icon: <History />, path: isFarmer ? '/farmer/redemption-history' : '/buyer/redemption-history' },
          { text: 'Payout Methods', icon: <CreditCard />, path: isFarmer ? '/farmer/payout-methods' : '/buyer/payout-methods' },
        ]
      }
    ];

    if (!isFarmer) {
      sections[0].items = sections[0].items.filter(item => item.text !== 'My Fields');
      sections[1].items = [];
    }

    return sections.filter(s => s.items.length > 0);
  };

  const menuSections = getMenuConfig(userType);
  const farmerProminentItems = new Set(['My Farms', 'Farm Orders', 'License Info', 'Transaction']);
  const isFarmerProminent = (text) => userType === 'farmer' && farmerProminentItems.has(text);

  const appBarRef = useRef(null);

  useEffect(() => {
    const el = appBarRef.current;
    if (!el) return;
    const update = () => {
      const h = el.offsetHeight || 0;
      document.documentElement.style.setProperty('--app-header-height', `${h}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [pickupReadyCount, isMobile]);

  return (
    <>
      <AppBar
        ref={appBarRef}
        position="fixed"
        sx={{
          background: 'rgba(255, 255, 255, 0.72)', // More translucent
          backdropFilter: 'blur(20px) saturate(180%)', // Heavier blur and saturation for "frosted" look
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          color: 'text.primary',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.03)', // Softer, more modern shadow
          borderBottom: '1px solid rgba(255, 255, 255, 0.3)', // "Inner glow" white border
          zIndex: 1300,
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {pickupReadyCount > 0 && (
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(90deg, rgba(255,235,59,0.25), rgba(255,152,0,0.25))',
              backdropFilter: 'blur(10px)',
              borderBottom: '1px solid rgba(245, 124, 0, 0.15)',
              px: 2,
              py: 0.8,
              cursor: 'pointer',
              transition: 'background 0.3s ease'
            }}
            onClick={() => setPickupPanelOpen(true)}
          >
            <style>{`@keyframes popPulse{0%{transform:scale(1)}50%{transform:scale(1.07)}100%{transform:scale(1)}}`}</style>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                fontWeight: 700,
                color: '#F57C00',
                textTransform: 'none',
                letterSpacing: '0.02em',
                animation: 'popPulse 1200ms ease-in-out infinite',
                willChange: 'transform',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                whiteSpace: 'nowrap',
                lineHeight: '20px',
                height: '20px',
                transformOrigin: 'center',
                contain: 'layout paint style',
              }}
            >
              <span style={{ fontSize: '14px' }}>✅</span>
              <span style={{ fontSize: '14px' }}>Your Product is ready for pickup</span>
            </Box>
          </Box>
        )}
        <Toolbar sx={{
          display: 'flex',
          alignItems: 'center',
          px: { xs: 1, sm: 2 },
          minHeight: { xs: 56, sm: 64 },
          gap: 1,
          position: 'relative'
        }}>
          {/* Left Section - Menu Button */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0
          }}>
            <IconButton
              edge="start"
              color="inherit"
              onClick={onMenuClick ? onMenuClick : toggleDrawer}
              sx={{
                mr: { xs: 0.5, sm: 1.5 },
                p: { xs: 1, sm: 1.2 },
                backgroundColor: 'rgba(0,0,0,0.03)',
                borderRadius: '12px',
                transition: 'all 0.2s',
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.06)',
                  transform: 'translateX(2px)'
                },
                '& .MuiSvgIcon-root': {
                  fontSize: { xs: '20px', sm: '22px' }
                }
              }}
            >
              <MenuIcon />
            </IconButton>
          </Box>

          {/* Center Section - Company Logo (dedicated space, no overlap) */}
          {!isMobile && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                px: 1.5,
                transition: 'transform 0.2s',
                '&:hover': { transform: 'scale(1.02)' }
              }}
              onClick={() => navigate('/')}
            >
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 900,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.2,
                  fontSize: { sm: '1.3rem', md: '1.6rem' },
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.02em',
                  filter: 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.1))'
                }}
              >
                🌱 ShareCrop
              </Typography>
            </Box>
          )}

          {/* Right Section - Search, Filter, Actions, Coins, Profile */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 0.5, sm: 1 },
            flex: 1,
            justifyContent: 'flex-end',
            minWidth: 0,
          }}>
            {!isAdmin && (
              <>
                {/* Search Section */}
                <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  {/* Mobile Search Icon */}
                  {isMobile && (
                    <Box sx={{ position: 'relative' }}>
                      <IconButton
                        color="inherit"
                        onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
                        size="small"
                        sx={{
                          backgroundColor: 'rgba(0,0,0,0.04)',
                          '&:hover': { backgroundColor: 'rgba(0,0,0,0.08)' },
                          '& .MuiSvgIcon-root': {
                            fontSize: '18px'
                          },
                          p: 1
                        }}
                      >
                        <Search />
                      </IconButton>

                      {/* Mobile Search Bar - full-width below header for better usability */}
                      {mobileSearchOpen && (
                        <Box
                          onClick={() => setMobileSearchOpen(false)}
                          sx={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 1298,
                            backgroundColor: 'rgba(0,0,0,0.2)',
                          }}
                        />
                      )}
                      {mobileSearchOpen && (
                        <Box
                          sx={{
                            position: 'fixed',
                            top: pickupReadyCount > 0 ? 88 : 56,
                            left: 0,
                            right: 0,
                            zIndex: 1299,
                            px: 1.5,
                            py: 1.5,
                            backgroundColor: 'rgba(255,255,255,0.98)',
                            backdropFilter: 'blur(8px)',
                            borderBottom: '1px solid rgba(0,0,0,0.08)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            animation: 'slideDown 0.2s ease-out'
                          }}
                        >
                          <Box
                            onClick={(e) => e.stopPropagation()}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              backgroundColor: 'white',
                              borderRadius: 20,
                              px: 2,
                              py: 0.5,
                              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                              border: '1px solid rgba(0,0,0,0.1)',
                              width: '100%',
                              maxWidth: '100%',
                            }}
                          >
                            <InputBase
                              placeholder="Search fields, crops..."
                              value={searchQuery}
                              onChange={(e) => {
                                const query = e.target.value;
                                setSearchQuery(query);

                                if (query.trim()) {
                                  let fieldsToSearch = applyFilters(fields);
                                  const filtered = fieldsToSearch.filter(field => fieldMatchesSearch(field, query));
                                  setFilteredFields(filtered.slice(0, 5));
                                  setSearchAnchorEl(e.currentTarget.parentElement);
                                } else {
                                  setFilteredFields([]);
                                  setSearchAnchorEl(null);
                                }

                                if (onSearchChange) {
                                  onSearchChange(query);
                                }
                              }}
                              onFocus={(e) => {
                                if (searchQuery.trim() && filteredFields.length > 0) {
                                  setSearchAnchorEl(e.currentTarget.parentElement);
                                }
                              }}
                              sx={{ flex: 1, fontSize: '14px', }}
                            />
                          </Box>
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Desktop Search Bar - icon only, expands on hover/focus */}
                  {!isMobile && (
                    <Box
                      ref={desktopSearchRef}
                      onMouseEnter={() => setDesktopSearchExpanded(true)}
                      onMouseLeave={() => {
                        if (!document.activeElement || !desktopSearchRef.current?.contains(document.activeElement)) {
                          setDesktopSearchExpanded(false);
                        }
                      }}
                      onClick={() => {
                        if (!desktopSearchExpanded) {
                          setDesktopSearchExpanded(true);
                          setTimeout(() => desktopSearchInputRef.current?.focus(), 50);
                        }
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: 'rgba(0,0,0,0.04)',
                        borderRadius: 20,
                        overflow: 'hidden',
                        transition: 'width 0.25s ease, min-width 0.25s ease',
                        width: desktopSearchExpanded ? 220 : 40,
                        minWidth: desktopSearchExpanded ? 220 : 40,
                        px: desktopSearchExpanded ? 2 : 0,
                        py: 0.5,
                        position: 'relative',
                        '&:hover': {
                          backgroundColor: 'rgba(0,0,0,0.06)'
                        }
                      }}
                    >
                      <Search sx={{ color: 'grey.500', flexShrink: 0, ml: 1, fontSize: '20px' }} />
                      <InputBase
                        inputRef={desktopSearchInputRef}
                        placeholder="Search fields, crops..."
                        value={searchQuery}
                        onBlur={() => {
                          if (!desktopSearchRef.current?.contains(document.activeElement)) {
                            setDesktopSearchExpanded(false);
                          }
                        }}
                        onFocus={(e) => {
                          setDesktopSearchExpanded(true);
                          if (searchQuery.trim() && filteredFields.length > 0) {
                            setSearchAnchorEl(e.currentTarget.parentElement);
                          }
                        }}
                        onChange={(e) => {
                          const query = e.target.value;
                          setSearchQuery(query);

                          if (query.trim()) {
                            let fieldsToSearch = applyFilters(fields);
                            const filtered = fieldsToSearch.filter(field => fieldMatchesSearch(field, query));
                            setFilteredFields(filtered.slice(0, 5));
                            setSearchAnchorEl(e.currentTarget.parentElement);
                          } else {
                            setFilteredFields([]);
                            setSearchAnchorEl(null);
                          }

                          if (onSearchChange) {
                            onSearchChange(query);
                          }
                        }}
                        sx={{
                          flex: 1,
                          fontSize: '14px',
                          minWidth: 0,
                          opacity: desktopSearchExpanded ? 1 : 0,
                          transition: 'opacity 0.2s ease',
                          pointerEvents: desktopSearchExpanded ? 'auto' : 'none'
                        }}
                      />
                    </Box>
                  )}
                </Box>

                {/* Filter Icon */}
                <Badge
                  badgeContent={activeFilters.categories.length + activeFilters.subcategories.length}
                  color="primary"
                  invisible={activeFilters.categories.length + activeFilters.subcategories.length === 0}
                  sx={{
                    '& .MuiBadge-badge': {
                      fontSize: '0.6rem',
                      height: 16,
                      minWidth: 16,
                    }
                  }}
                >
                  <IconButton
                    color="inherit"
                    onClick={(e) => setFilterAnchorEl(e.currentTarget)}
                    size={isMobile ? "small" : "medium"}
                    sx={{
                      backgroundColor: 'rgba(0,0,0,0.04)',
                      '&:hover': { backgroundColor: 'rgba(0,0,0,0.08)' },
                      ...(filterAnchorEl && {
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        color: 'primary.main'
                      }),
                      ...(activeFilters.categories.length + activeFilters.subcategories.length > 0 && {
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        color: 'primary.main'
                      }),
                      '& .MuiSvgIcon-root': {
                        fontSize: isMobile ? '18px' : '24px'
                      }
                    }}
                  >
                    <Tune />
                  </IconButton>
                </Badge>
              </>
            )}

            {/* Create Field Button - Only show for farmers */}
            {userType === 'farmer' && (
              <Tooltip title="Create New Field">
                <IconButton
                  color="inherit"
                  onClick={onCreateField}
                  size={isMobile ? "small" : "medium"}
                  sx={{
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    color: '#4CAF50',
                    '&:hover': {
                      backgroundColor: 'rgba(76, 175, 80, 0.2)',
                      transform: 'scale(1.05)'
                    },
                    transition: 'all 0.2s ease-in-out',
                    border: '1px solid rgba(76, 175, 80, 0.3)',
                    '& .MuiSvgIcon-root': {
                      fontSize: isMobile ? '18px' : '24px'
                    }
                  }}
                >
                  <Add />
                </IconButton>
              </Tooltip>
            )}



            {/* Notifications Bell */}
            {!isAdmin && (
              <>
                <IconButton
                  color="inherit"
                  onClick={(e) => {
                    setNotifAnchorEl(e.currentTarget);
                    if (typeof onRefreshNotifications === 'function') onRefreshNotifications();
                  }}
                  sx={(theme) => ({
                    mr: 1,
                    backgroundColor: notifAnchorEl ? alpha(theme.palette.secondary.main, 0.2) : alpha(theme.palette.secondary.main, 0.1),
                    color: theme.palette.secondary.main,
                    border: `1px solid ${alpha(theme.palette.secondary.main, 0.3)}`,
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.secondary.main, 0.2),
                      transform: 'scale(1.05)'
                    },
                    transition: 'all 0.2s ease-in-out',
                    '& .MuiSvgIcon-root': {
                      fontSize: isMobile ? '18px' : '24px'
                    }
                  })}
                >
                  <Badge
                    badgeContent={(backendNotifications ?? []).filter(n => !n.read).length}
                    color="error"
                    invisible={(backendNotifications ?? []).filter(n => !n.read).length === 0}
                  >
                    <Notifications sx={{ fontSize: isMobile ? 20 : 24 }} />
                  </Badge>
                </IconButton>
                {/* Messages - badge shows new messages count, click opens messages dropdown */}
                <Tooltip title="Messages">
                  <IconButton
                    color="inherit"
                    onClick={(e) => {
                      setMessagesAnchorEl(e.currentTarget);
                      fetchUnreadStats();
                    }}
                    sx={(theme) => ({
                      mr: 1,
                      backgroundColor: messagesAnchorEl ? alpha(theme.palette.primary.main, 0.2) : alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.2),
                        transform: 'scale(1.05)'
                      },
                      transition: 'all 0.2s ease-in-out',
                      '& .MuiSvgIcon-root': {
                        fontSize: isMobile ? '18px' : '24px'
                      }
                    })}
                  >
                    <Badge badgeContent={unreadCount} color="error" invisible={!unreadCount}>
                      <Message sx={{ fontSize: isMobile ? 20 : 24 }} />
                    </Badge>
                  </IconButton>
                </Tooltip>
              </>
            )}
            {/* Farmer Coins – click opens menu (like profile) */}
            {!isAdmin && (
              <>
                <Chip
                  icon={<span style={{ fontSize: isMobile ? '12px' : '14px' }}>🪙</span>}
                  label={userCoins.toLocaleString()}
                  variant="outlined"
                  size={isMobile ? "small" : "medium"}
                  onClick={(e) => setCoinsMenuAnchorEl(e.currentTarget)}
                  sx={{
                    fontWeight: 'bold',
                    borderColor: '#FF9800',
                    color: '#F57C00',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    cursor: 'pointer',
                    height: isMobile ? 24 : 32,
                    '& .MuiChip-label': {
                      fontSize: isMobile ? '11px' : '12px',
                      px: isMobile ? 0.5 : 1
                    },
                    '& .MuiChip-icon': {
                      marginLeft: isMobile ? '4px' : '8px',
                      marginRight: isMobile ? '-2px' : '-6px'
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(255, 152, 0, 0.2)',
                      borderColor: '#F57C00',
                    }
                  }}
                />
                <Menu
                  anchorEl={coinsMenuAnchorEl}
                  open={Boolean(coinsMenuAnchorEl)}
                  onClose={() => setCoinsMenuAnchorEl(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  PaperProps={{
                    sx: {
                      mt: 1.5,
                      minWidth: 220,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      borderRadius: 2,
                    }
                  }}
                >
                  <Box sx={{ px: 2, py: 1.5, bgcolor: 'rgba(255, 152, 0, 0.08)', borderBottom: '1px solid rgba(255,152,0,0.2)' }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block' }}>
                      Coins balance
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700, color: '#F57C00' }}>
                      {userCoins.toLocaleString()} coins
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '10px' }}>
                      1 coin = $0.10 · ${(userCoins * 0.1).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} value
                    </Typography>
                  </Box>
                  <MenuItem
                    onClick={() => {
                      setCoinsMenuAnchorEl(null);
                      navigate(userType === 'farmer' ? '/farmer/transaction' : '/buyer/transaction');
                    }}
                  >
                    <ListItemIcon>
                      <History fontSize="small" />
                    </ListItemIcon>
                    See transaction history
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setCoinsMenuAnchorEl(null);
                      navigate(userType === 'farmer' ? '/farmer/buy-coins' : '/buyer/buy-coins');
                    }}
                  >
                    <ListItemIcon>
                      <MonetizationOn fontSize="small" />
                    </ListItemIcon>
                    Add coins
                  </MenuItem>
                  <Divider />
                  <MenuItem
                    onClick={() => {
                      setCoinsMenuAnchorEl(null);
                      navigate(userType === 'farmer' ? '/farmer/redeem-coins' : '/buyer/redeem-coins');
                    }}
                  >
                    <ListItemIcon>
                      <AccountBalanceWallet fontSize="small" />
                    </ListItemIcon>
                    Redeem coins for cash
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setCoinsMenuAnchorEl(null);
                      navigate(userType === 'farmer' ? '/farmer/redemption-history' : '/buyer/redemption-history');
                    }}
                  >
                    <ListItemIcon>
                      <History fontSize="small" />
                    </ListItemIcon>
                    Redemption history
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setCoinsMenuAnchorEl(null);
                      navigate(userType === 'farmer' ? '/farmer/payout-methods' : '/buyer/payout-methods');
                    }}
                  >
                    <ListItemIcon>
                      <CreditCard fontSize="small" />
                    </ListItemIcon>
                    Payout methods
                  </MenuItem>
                </Menu>
              </>
            )}
            {/* Profile - Clickable Avatar with Menu (visible on mobile and desktop) */}
            <>
              <Box
                onClick={(e) => setUserMenuAnchorEl(e.currentTarget)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  cursor: 'pointer',
                  borderRadius: 2,
                  px: 0.5,
                  py: 0.5,
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                <Avatar
                  src={user?.profile_image_url}
                  sx={{
                    width: isMobile ? 32 : 36,
                    height: isMobile ? 32 : 36,
                    bgcolor: 'primary.main',
                    fontSize: isMobile ? '12px' : '14px',
                    cursor: 'pointer'
                  }}
                >
                  {!user?.profile_image_url && (user?.name?.charAt(0)?.toUpperCase() || 'U')}
                </Avatar>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    color: 'text.primary',
                    display: { xs: 'none', sm: 'block' }
                  }}
                >
                  {user?.name?.split(' ')[0] || user?.name || 'User'}
                </Typography>
              </Box>

              <Menu
                anchorEl={userMenuAnchorEl}
                open={Boolean(userMenuAnchorEl)}
                onClose={() => setUserMenuAnchorEl(null)}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                PaperProps={{
                  sx: {
                    mt: 1,
                    minWidth: 200,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    borderRadius: 2,
                  }
                }}
              >
                <MenuItem disabled>
                  <ListItemIcon>
                    <Person fontSize="small" />
                  </ListItemIcon>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {user?.name || 'User'}
                  </Typography>
                </MenuItem>
                <Divider />
                <MenuItem
                  onClick={() => {
                    setUserMenuAnchorEl(null);
                    navigate(userType === 'farmer' ? '/farmer/profile' : userType === 'admin' ? '/admin/profile' : '/buyer/profile');
                  }}
                >
                  <ListItemIcon>
                    <Person fontSize="small" />
                  </ListItemIcon>
                  View Profile
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setUserMenuAnchorEl(null);
                    if (onLogout) {
                      onLogout();
                    }
                  }}
                  sx={{ color: 'error.main' }}
                >
                  <ListItemIcon>
                    <ExitToApp fontSize="small" sx={{ color: 'error.main' }} />
                  </ListItemIcon>
                  Logout
                </MenuItem>
              </Menu>
            </>

            {/* Activity Dropdown: backend notifications only */}
            <Menu
              anchorEl={notifAnchorEl}
              open={Boolean(notifAnchorEl)}
              onClose={() => setNotifAnchorEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              PaperProps={{
                sx: {
                  mt: 1.5,
                  width: { xs: 320, sm: 380 },
                  maxHeight: 480,
                  borderRadius: 3,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  overflow: 'hidden'
                }
              }}
            >
              <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b' }}>Activity</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {((backendNotifications ?? []).filter(n => !n.read).length) > 0 && (
                    <Button
                      size="small"
                      variant="text"
                      onClick={(e) => {
                        e.stopPropagation();
                        (backendNotifications ?? []).filter(n => !n.read).forEach((n) => { if (typeof onMarkNotificationAsRead === 'function') onMarkNotificationAsRead(n.id); });
                      }}
                      sx={{ minWidth: 0, py: 0.25, px: 1, fontSize: '0.75rem', color: '#4caf50', fontWeight: 600 }}
                    >
                      Mark all read
                    </Button>
                  )}
                  {(backendNotifications ?? []).filter(n => !n.read).length > 0 && (
                    <Chip
                      label={`${(backendNotifications ?? []).filter(n => !n.read).length} unread`}
                      size="small"
                      color="primary"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  )}
                </Box>
              </Box>
              <List sx={{ py: 0, maxHeight: 400, overflow: 'auto' }}>
                {(() => {
                  const notifItems = (backendNotifications ?? []).slice(0, 25).map(n => ({ type: 'notification', ...n, sortAt: new Date(n.created_at || 0).getTime() })).sort((a, b) => (b.sortAt || 0) - (a.sortAt || 0));
                  if (notifItems.length === 0) {
                    return (
                      <Box sx={{ py: 4, textAlign: 'center' }}>
                        <Notifications sx={{ fontSize: 40, color: '#cbd5e1', mb: 1 }} />
                        <Typography variant="body2" sx={{ color: '#94a3b8' }}>No activity yet</Typography>
                      </Box>
                    );
                  }
                  return notifItems.map((item) => {
                    const notif = item;
                    const isUnread = !notif.read;
                    const Icon = notif.type === 'success' ? CheckCircle : notif.type === 'warning' ? Warning : notif.type === 'error' ? ErrorIcon : notif.type === 'info' ? Info : NotificationsActive;
                    const iconColor = notif.type === 'success' ? '#22c55e' : notif.type === 'warning' ? '#eab308' : notif.type === 'error' ? '#ef4444' : '#3b82f6';
                    return (
                      <MenuItem
                        key={notif.id}
                        onClick={() => { if (isUnread && typeof onMarkNotificationAsRead === 'function') onMarkNotificationAsRead(notif.id); }}
                        sx={{
                          py: 1.25,
                          px: 2,
                          borderBottom: '1px solid #f1f5f9',
                          bgcolor: isUnread ? 'rgba(76, 175, 80, 0.06)' : 'transparent',
                          '&:hover': { bgcolor: isUnread ? 'rgba(76, 175, 80, 0.1)' : '#f8fafc' }
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <Avatar sx={{ width: 36, height: 36, bgcolor: `${iconColor}20`, color: iconColor }}>
                            <Icon sx={{ fontSize: 20 }} />
                          </Avatar>
                        </ListItemIcon>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Notification</Typography>
                            {notif.created_at && (
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                {new Date(notif.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </Typography>
                            )}
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: isUnread ? 600 : 500, color: '#1e293b', display: '-webkit-box', overflow: 'hidden', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>
                            {notif.message}
                          </Typography>
                          {isUnread && (
                            <Button
                              size="small"
                              variant="text"
                              onClick={(e) => { e.stopPropagation(); if (typeof onMarkNotificationAsRead === 'function') onMarkNotificationAsRead(notif.id); }}
                              sx={{ minWidth: 0, py: 0.25, px: 0.5, mt: 0.5, fontSize: '0.7rem', color: '#4caf50', fontWeight: 600 }}
                            >
                              Mark read
                            </Button>
                          )}
                        </Box>
                      </MenuItem>
                    );
                  });
                })()}
              </List>
              <Divider />
            </Menu>

            {/* Messages Dropdown: recent chats only */}
            {!isAdmin && (
              <Menu
                anchorEl={messagesAnchorEl}
                open={Boolean(messagesAnchorEl)}
                onClose={() => setMessagesAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{
                  sx: {
                    mt: 1.5,
                    width: { xs: 320, sm: 380 },
                    maxHeight: 480,
                    borderRadius: 3,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    overflow: 'hidden'
                  }
                }}
              >
                <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b' }}>Messages</Typography>
                  {unreadCount > 0 && (
                    <Chip label={`${unreadCount} unread`} size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem' }} />
                  )}
                </Box>
                <List sx={{ py: 0, maxHeight: 400, overflow: 'auto' }}>
                  {(() => {
                    const messageItems = (recentChats || [])
                      .filter(c => c.last_message != null && String(c.last_message).trim() !== '')
                      .slice(0, 10)
                      .sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
                    if (messageItems.length === 0) {
                      return (
                        <Box sx={{ py: 4, textAlign: 'center' }}>
                          <Message sx={{ fontSize: 40, color: '#cbd5e1', mb: 1 }} />
                          <Typography variant="body2" sx={{ color: '#94a3b8' }}>No messages yet</Typography>
                        </Box>
                      );
                    }
                    return messageItems.map((chat) => (
                      <MenuItem
                        key={chat.id}
                        onClick={() => {
                          setMessagesAnchorEl(null);
                          navigate(userType === 'farmer' ? '/farmer/messages' : '/buyer/messages');
                        }}
                        sx={{
                          py: 1.25,
                          px: 2,
                          borderBottom: '1px solid #f1f5f9',
                          bgcolor: chat.unread_count > 0 ? 'rgba(76, 175, 80, 0.06)' : 'transparent',
                          '&:hover': { bgcolor: chat.unread_count > 0 ? 'rgba(76, 175, 80, 0.1)' : '#f8fafc' }
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <Avatar src={chat.participant_avatar} sx={{ width: 36, height: 36, bgcolor: '#e2e8f0', color: '#64748b' }}>
                            {chat.participant_name?.charAt(0)}
                          </Avatar>
                        </ListItemIcon>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Message</Typography>
                            {chat.last_message_at && (
                              <Typography variant="caption" sx={{ color: '#94a3b8', flexShrink: 0 }}>
                                {new Date(chat.last_message_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </Typography>
                            )}
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: chat.unread_count > 0 ? 600 : 500, color: '#1e293b' }}>
                            {chat.participant_name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {chat.last_message || 'No messages yet'}
                            {chat.unread_count > 0 && <Typography component="span" variant="caption" sx={{ color: '#4caf50', fontWeight: 600, ml: 0.5 }}>· New</Typography>}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ));
                  })()}
                </List>
                <Divider />
                <Box sx={{ p: 1, textAlign: 'center' }}>
                  <Button
                    fullWidth
                    size="small"
                    onClick={() => {
                      setMessagesAnchorEl(null);
                      navigate(userType === 'farmer' ? '/farmer/messages' : '/buyer/messages');
                    }}
                    sx={{ color: 'primary.main', fontWeight: 600 }}
                  >
                    View all messages
                  </Button>
                </Box>
              </Menu>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      <Dialog open={pickupPanelOpen} onClose={() => setPickupPanelOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>Ready for Pickup</DialogTitle>
        <DialogContent dividers>
          <List>
            {pickupReadyList.map((item) => (
              <ListItem
                key={`pickup-${item.id}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <Avatar src={getProductIcon(item.subcategory || item.category)} sx={{ bgcolor: 'transparent' }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{item.name || item.product_name || 'Product'}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>{item.location || 'Location'}</Typography>
                </Box>
                <Button
                  variant="outlined"
                  color="warning"
                  onClick={() => {
                    if (onFarmSelect) onFarmSelect(item);
                    setTimeout(() => setPickupPanelOpen(false), 450);
                  }}
                >
                  View on Map
                </Button>
              </ListItem>
            ))}
            {pickupReadyList.length === 0 && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>No items ready today.</Typography>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPickupPanelOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Collapsible Side Menu */}
      {userType !== 'admin' && (
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={toggleDrawer}
          sx={{
            '& .MuiDrawer-paper': {
              width: isMobile ? 220 : 280,
              boxSizing: 'border-box',
              backgroundColor: '#ffffff',
              top: 'var(--app-header-height)',
              height: 'calc(100% - var(--app-header-height))',
              pt: 2,
            },
          }}
        >
          <Box sx={{ p: isMobile ? 1.5 : 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: isMobile ? 1.5 : 2 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 'bold',
                  fontSize: isMobile ? '1.1rem' : '1.25rem'
                }}
              >
                🌱 ShareCrop
              </Typography>
              <IconButton onClick={toggleDrawer} size="small">
                <Close />
              </IconButton>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', mb: isMobile ? 1.5 : 2 }}>
              <Avatar
                src={user?.profile_image_url}
                sx={{
                  mr: isMobile ? 1.5 : 2,
                  bgcolor: 'primary.main',
                  width: isMobile ? 36 : 40,
                  height: isMobile ? 36 : 40,
                  fontSize: isMobile ? '0.9rem' : '1rem'
                }}
              >
                {!user?.profile_image_url && (user?.name?.charAt(0)?.toUpperCase() || 'U')}
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: 'bold',
                    fontSize: isMobile ? '0.9rem' : '1rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {user?.name?.split(' ')[0] || user?.name || 'User'}
                </Typography>
                <Chip
                  label={user?.user_type || 'User'}
                  size="small"
                  color={user?.user_type === 'farmer' ? 'primary' : 'secondary'}
                  sx={{
                    textTransform: 'capitalize',
                    fontSize: isMobile ? '0.7rem' : '0.75rem',
                    height: isMobile ? 20 : 24
                  }}
                />
              </Box>
            </Box>
          </Box>

          <Divider />

          {/* Simplified Menu with Clean Categories */}
          <Box sx={{ py: isMobile ? 0.5 : 1 }}>
            {menuSections.map((section, idx) => (
              <React.Fragment key={section.id}>
                <Box sx={{ mb: isMobile ? 0.5 : 1 }}>
                  {section.title && (
                    <Box sx={{
                      px: isMobile ? 1.5 : 2,
                      py: isMobile ? 0.25 : 0.5,
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <ListItemText
                        primary={section.title}
                        primaryTypographyProps={{
                          fontSize: isMobile ? '0.7rem' : '0.75rem',
                          fontWeight: 600,
                          color: '#2E7D32',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}
                      />
                    </Box>
                  )}
                  {/* Section Items - Clean and spaced */}
                  <List component="div" disablePadding>
                    {section.items.map((item) => {
                      const prominent = isFarmerProminent(item.text);
                      return (
                        <ListItem
                          button
                          key={item.path}
                          onClick={() => handleNavigation(item.path)}
                          selected={location.pathname === item.path}
                          sx={{
                            py: isMobile ? 0.5 : 0.75,
                            px: isMobile ? 2 : 2.5,
                            minHeight: isMobile ? 32 : 40,
                            borderRadius: '4px',
                            mx: isMobile ? 0.5 : 1,
                            mb: 0.25,
                            transition: 'all 0.2s ease',
                            ...(prominent && {
                              color: '#2E7D32',
                              '& .MuiListItemIcon-root': { color: '#2E7D32' },
                              '& .MuiListItemText-primary': { fontWeight: 700 },
                            }),
                            '&.Mui-selected': {
                              backgroundColor: 'rgba(76, 175, 80, 0.1)',
                              color: '#2E7D32',
                              '& .MuiListItemIcon-root': {
                                color: '#2E7D32',
                              },
                            },
                            '&:hover': {
                              backgroundColor: prominent ? 'rgba(76, 175, 80, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                              transform: 'translateX(2px)',
                            },
                          }}
                        >
                          <ListItemIcon sx={{
                            color: prominent ? '#2E7D32' : 'inherit',
                            minWidth: isMobile ? 24 : 32,
                            '& svg': {
                              fontSize: isMobile ? (prominent ? '1rem' : '0.9rem') : (prominent ? '1.1rem' : '1rem')
                            }
                          }}>
                            {item.icon}
                          </ListItemIcon>
                          <ListItemText
                            primary={item.text}
                            primaryTypographyProps={{
                              fontSize: isMobile ? '0.8rem' : '0.85rem',
                              fontWeight: prominent ? 700 : (location.pathname === item.path ? 500 : 400)
                            }}
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                </Box>
                {idx < menuSections.length - 1 && <Divider sx={{ my: 1, borderStyle: 'dashed', borderColor: '#2E7D32' }} />}
              </React.Fragment>
            ))}
          </Box>

          <Divider />

          <List sx={{ py: isMobile ? 0.5 : 1 }}>
            <ListItem
              button
              onClick={handleLogout}
              sx={{
                py: isMobile ? 0.5 : 1,
                px: isMobile ? 1.5 : 2,
                minHeight: isMobile ? 40 : 48,
              }}
            >
              <ListItemIcon sx={{
                minWidth: isMobile ? 32 : 40,
                '& svg': {
                  fontSize: isMobile ? '1.2rem' : '1.5rem'
                }
              }}>
                <ExitToApp />
              </ListItemIcon>
              <ListItemText
                primary="Logout"
                primaryTypographyProps={{
                  fontSize: isMobile ? '0.85rem' : '1rem',
                  fontWeight: 400
                }}
              />
            </ListItem>
          </List>
        </Drawer>
      )}

      {/* Search Dropdown */}
      <Popper
        open={Boolean(searchAnchorEl) && filteredFields.length > 0}
        anchorEl={searchAnchorEl}
        placement="bottom-start"
        modifiers={[
          {
            name: 'offset',
            options: {
              offset: [0, 4],
            },
          },
        ]}
        sx={{
          zIndex: 1400,
          width: Math.max(searchAnchorEl?.offsetWidth || 280, 280),
          maxWidth: 'calc(100vw - 24px)',
          ...(isMobile && {
            width: 'min(260px, calc(100vw - 24px))',
          })
        }}
      >
        <ClickAwayListener onClickAway={() => setSearchAnchorEl(null)}>
          <Paper
            sx={{
              mt: 0.5,
              ml: -2,
              width: '100%',
              maxWidth: isMobile ? 'calc(100vw - 24px)' : 380,
              maxHeight: 'min(320px, 60vh)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 2,
            }}
          >
            <MenuList
              sx={{
                py: 0.5,
                overflow: 'auto',
                maxHeight: 'min(320px, 60vh)',
                minWidth: 0,
              }}
            >
              {filteredFields.map((field) => (
                <MenuItem
                  key={field.id}
                  onClick={() => {
                    if (onFarmSelect) {
                      onFarmSelect(field);
                    }
                    const displayName = field.product_name || field.productName || field.name;
                    setSearchQuery(displayName);
                    setSearchAnchorEl(null);
                    setFilteredFields([]);
                  }}
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    py: isMobile ? 0.6 : 0.8,
                    px: isMobile ? 1.5 : 2,
                    minHeight: 'auto',
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    '&:hover': {
                      backgroundColor: 'rgba(46, 125, 50, 0.04)',
                    },
                    '&:not(:last-child)': {
                      borderBottom: '1px solid rgba(0,0,0,0.08)',
                    },
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      fontSize: isMobile ? '0.7rem' : '0.8rem',
                      color: 'text.primary',
                      mb: 0.2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      width: '100%',
                      minWidth: 0,
                    }}
                  >
                    {highlightMatch(field.product_name || field.productName || field.name, searchQuery)}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: isMobile ? '0.6rem' : '0.7rem',
                      color: 'text.secondary',
                      mb: 0.2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      width: '100%',
                      minWidth: 0,
                    }}
                  >
                    {highlightMatch(field.farmer_name || field.farmer || field.owner, searchQuery)}
                    {(field.location != null && field.location !== '') && <> • {highlightMatch(field.location, searchQuery)}</>}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: isMobile ? '0.55rem' : '0.65rem',
                      color: 'success.main',
                      fontWeight: 400,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      width: '100%',
                      minWidth: 0,
                    }}
                  >
                    {highlightMatch(field.category || field.subcategory, searchQuery)}
                  </Typography>
                </MenuItem>
              ))}
            </MenuList>
          </Paper>
        </ClickAwayListener>
      </Popper>

      {/* Filter Menu */}
      <Popper
        open={Boolean(filterAnchorEl)}
        anchorEl={filterAnchorEl}
        placement="bottom-end"
        modifiers={[
          {
            name: 'offset',
            options: {
              offset: [110, 5],
            },
          },
          {
            name: 'preventOverflow',
            enabled: true,
            options: {
              boundary: 'viewport',
              padding: 8,
            },
          },
        ]}
        sx={{
          zIndex: 1400,
          position: 'fixed !important',
        }}
      >
        <ClickAwayListener onClickAway={() => setFilterAnchorEl(null)}>
          <Paper
            elevation={8}
            sx={{
              width: 260,
              maxHeight: 'calc(100vh - 120px)',
              overflowY: 'auto',
              overflowX: 'hidden',
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 2,
              mt: 0.5,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box sx={{ p: 2, flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 600, fontSize: '0.8rem', color: 'text.primary', flexShrink: 0 }}>
                Filter Farms
              </Typography>
              <Divider sx={{ mb: 2, flexShrink: 0 }} />

              {/* Category and Subcategory Filters */}
              <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, fontSize: '0.7rem', color: 'text.secondary' }}>
                  Categories
                </Typography>
                {(() => {
                  const CATEGORY_OPTIONS = {
                    'Beverages': ['Beer', 'Coffee', 'Juice', 'Milk', 'Soda', 'Teabags', 'Wine'],
                    'Bread & Bakery': ['Bagels', 'Bread', 'Cookies', 'Muffins', 'Pies', 'Tortillas'],
                    'Canned Goods': ['Fruit', 'Pasta Sauce', 'Soup', 'Vegetables'],
                    'Dairy': ['Butter', 'Cheese', 'Eggs', 'Milk'],
                    'Deli': ['Cheeses', 'Salami'],
                    'Fish & Seafood': ['Bivalves & Clams', 'Crab', 'Fish', 'Lobster', 'Octopus & Squid', 'Shrimp'],
                    'Frozen Food': ['Fish', 'Ice cream', 'Pizza', 'Potatoes', 'Ready Meals'],
                    'Fruits': ['Green Apple', 'Red Apple', 'Peach', 'Strawberry', 'Tangerine', 'Watermelon', 'Avocados', 'Mango', 'Grapes', 'Banana'],
                    'Vegetables': ['Corn', 'Eggplant', 'Lemon', 'Tomato', 'Broccoli', 'Capsicum', 'Carrot', 'Onions', 'Potatoes', 'Salad Greens'],
                    'Meat': ['Bacon', 'Chicken', 'Beef', 'Pork'],
                    'Oil': ['Coconut Oil', 'Olive Oil', 'Peanut Oil', 'Sunflower Oil'],
                    'Seeds': ['Hibiscus', 'Rice Seeds', 'Rose'],
                    'Snacks': ['Nuts', 'Popcorn', 'Pretzels']
                  };
                  const categories = Object.keys(CATEGORY_OPTIONS);
                  const isAllSubsSelected = (category) => {
                    const subs = CATEGORY_OPTIONS[category] || [];
                    return subs.length > 0 && subs.every(s => activeFilters.subcategories.includes(s));
                  };
                  const isSomeSubsSelected = (category) => {
                    const subs = CATEGORY_OPTIONS[category] || [];
                    const count = subs.filter(s => activeFilters.subcategories.includes(s)).length;
                    return count > 0 && count < subs.length;
                  };
                  return (
                    <Box>
                      {categories.map((category) => {
                        const checkedCat = activeFilters.categories.includes(category) || isAllSubsSelected(category);
                        const indeterminateCat = !checkedCat && isSomeSubsSelected(category);
                        return (
                          <Box key={category} sx={{ mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    size="small"
                                    checked={checkedCat}
                                    indeterminate={indeterminateCat}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setActiveFilters(prev => {
                                        const subs = CATEGORY_OPTIONS[category] || [];
                                        let categories = prev.categories;
                                        let subcategories = prev.subcategories;
                                        if (checked) {
                                          categories = categories.includes(category) ? categories : [...categories, category];
                                          const mergedSubs = new Set(subcategories);
                                          subs.forEach(s => mergedSubs.add(s));
                                          subcategories = Array.from(mergedSubs);
                                        } else {
                                          categories = categories.filter(c => c !== category);
                                          subcategories = subcategories.filter(s => !subs.includes(s));
                                        }
                                        return { ...prev, categories, subcategories };
                                      });
                                    }}
                                  />
                                }
                                label={category}
                                sx={{
                                  '& .MuiFormControlLabel-label': {
                                    fontSize: '0.65rem',
                                    color: 'text.primary'
                                  },
                                  '& .MuiCheckbox-root': {
                                    color: 'rgba(76, 175, 80, 0.6)',
                                    '&.Mui-checked': {
                                      color: '#4CAF50'
                                    }
                                  }
                                }}
                              />
                              <IconButton size="small" onClick={() => setExpanded(prev => ({ ...prev, [category]: !prev[category] }))}>
                                <ExpandMore sx={{ transform: expanded[category] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                              </IconButton>
                            </Box>
                            <Box sx={{ pl: 2 }}>
                              <Box sx={{ display: expanded[category] ? 'block' : 'none' }}>
                                <FormGroup>
                                  {CATEGORY_OPTIONS[category].map((sub) => (
                                    <FormControlLabel
                                      key={`${category}-${sub}`}
                                      control={
                                        <Checkbox
                                          size="small"
                                          checked={activeFilters.subcategories.includes(sub)}
                                          onChange={(e) => {
                                            const checked = e.target.checked;
                                            setActiveFilters(prev => {
                                              const subs = CATEGORY_OPTIONS[category] || [];
                                              let categories = prev.categories;
                                              let subcategories = prev.subcategories;
                                              if (checked) {
                                                subcategories = subcategories.includes(sub) ? subcategories : [...subcategories, sub];
                                              } else {
                                                subcategories = subcategories.filter(s => s !== sub);
                                              }
                                              const allSelected = subs.every(s => subcategories.includes(s));
                                              if (allSelected) {
                                                categories = categories.includes(category) ? categories : [...categories, category];
                                              } else {
                                                categories = categories.filter(c => c !== category);
                                              }
                                              return { ...prev, categories, subcategories };
                                            });
                                          }}
                                        />
                                      }
                                      label={sub}
                                      sx={{
                                        '& .MuiFormControlLabel-label': {
                                          fontSize: '0.65rem',
                                          color: 'text.primary'
                                        },
                                        '& .MuiCheckbox-root': {
                                          color: 'rgba(76, 175, 80, 0.6)',
                                          '&.Mui-checked': {
                                            color: '#4CAF50'
                                          }
                                        }
                                      }}
                                    />
                                  ))}
                                </FormGroup>
                              </Box>
                            </Box>
                            <Divider sx={{ my: 1 }} />
                          </Box>
                        );
                      })}
                    </Box>
                  );
                })()}
              </Box>

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', gap: 1, mt: 2, flexShrink: 0, pt: 2, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleFilterClear}
                  sx={{ flex: 1 }}
                >
                  Clear All
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleFilterApply}
                  sx={{ flex: 1 }}
                >
                  Apply
                </Button>
              </Box>
            </Box>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </>
  );
});

export default EnhancedHeader;
