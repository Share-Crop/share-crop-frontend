import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Avatar,
  TextField,
  IconButton,
  Badge,
  Paper,
  InputAdornment,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Send,
  Search,
  Schedule,
  ChatBubbleOutline,
  Add,
  ArrowBack,
  DoneAll,
  VerifiedUser
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { messagingService } from '../services/messaging';
import supabase from '../services/supabase';

const Messages = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);

  // Realtime Configuration Check
  useEffect(() => {
    if (!supabase) {
      console.error('Supabase client is not initialized. check your .env variables: REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY');
    }
  }, []);

  // New Chat Dialog State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchUserTerm, setSearchUserTerm] = useState('');
  const [foundUsers, setFoundUsers] = useState([]);
  const [searching, setSearching] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const displayName = (name, userType) =>
    userType === 'admin' ? 'Share-Crop' : (name || 'User');
  const isAdmin = (userType) => userType === 'admin';

  const fetchConversations = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const data = await messagingService.getConversations();
      setConversations(data);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (convId) => {
    try {
      setMsgLoading(true);
      const data = await messagingService.getMessages(convId);
      setMessages(data);
      // Clear unread count locally for this conversation
      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, unread_count: 0 } : c
      ));
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setMsgLoading(false);
    }
  }, []);

  const searchUsers = useCallback(async () => {
    try {
      setSearching(true);
      const data = await messagingService.searchUsers(searchUserTerm);
      // Filter out current user from search results
      setFoundUsers(data.filter(u => u.id !== user?.id));
    } catch (err) {
      console.error('Error searching users:', err);
    } finally {
      setSearching(false);
    }
  }, [user?.id, searchUserTerm]);

  // 1. Initial Data Fetching
  useEffect(() => {
    if (user) {
      fetchConversations(true); // Initial load with spinner
    }
  }, [user, fetchConversations]);

  // Open chat with specific user when navigated from field popup (e.g. "Chat to owner")
  useEffect(() => {
    const openWithUserId = location.state?.openWithUserId;
    if (!user?.id || !openWithUserId || openWithUserId === user.id) return;
    let cancelled = false;
    const openWith = async () => {
      try {
        const conv = await messagingService.startConversation(openWithUserId);
        if (cancelled) return;
        const freshList = await messagingService.getConversations();
        const found = freshList.find(c => c.id === conv.id);
        setConversations(freshList);
        setSelectedConversation(found || conv);
      } catch (err) {
        console.error('Error opening chat with owner:', err);
      }
      if (!cancelled) navigate(location.pathname, { replace: true, state: {} });
    };
    openWith();
    return () => { cancelled = true; };
  }, [user?.id, location.state?.openWithUserId, location.pathname, navigate]);

  // 2. Fetch Messages when selecting conversation
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);

      // Setup Realtime Subscription for this conversation
      if (supabase) {
        const channel = supabase
          .channel(`messages-${selectedConversation.id}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedConversation.id}`
          }, payload => {
            const newMsg = payload.new;

            setMessages(prev => {
              // 1. If message already exists by ID, ignore
              if (prev.some(m => m.id === newMsg.id)) return prev;

              // 2. If it's my message, try to find the optimistic/temp one and replace it
              if (newMsg.sender_id === user?.id) {
                const tempMatch = prev.find(m => m.is_temp && m.content === newMsg.content);
                if (tempMatch) {
                  // Replace temp with real immediately to prevent flicker
                  return prev.map(m => m.id === tempMatch.id ? newMsg : m);
                }
              }

              // 3. Otherwise add as new
              return [...prev, newMsg];
            });

            // Update sidebar preview
            setConversations(prev => prev.map(c =>
              c.id === selectedConversation.id
                ? { ...c, last_message: newMsg.content, last_message_at: newMsg.created_at }
                : c
            ));

            // If we are currently viewing this conversation, mark the message as read
            if (newMsg.sender_id !== user.id) {
              messagingService.markAsRead(selectedConversation.id);
            }
          })
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedConversation.id}`
          }, payload => {
            const updatedMsg = payload.new;
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
          })
          .subscribe((status) => {
          });

        return () => {
          supabase.removeChannel(channel);
        };
      }
    }
  }, [selectedConversation, user?.id, fetchMessages]);

  // 3. Realtime Subscription for Conversation List
  useEffect(() => {
    if (user && supabase) {
      const convChannel = supabase
        .channel(`conversations-updates`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'conversations'
        }, payload => {
          const conv = payload.new || payload.old;
          if (conv.user1_id === user.id || conv.user2_id === user.id) {
            // Background refresh without showing loading spinner
            fetchConversations(false);
          }
        })
        .subscribe((status) => {
        });

      return () => {
        supabase.removeChannel(convChannel);
      };
    }
  }, [user, fetchConversations]);

  // User Search Logic
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchUserTerm.trim().length >= 2) {
        searchUsers();
      } else {
        setFoundUsers([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchUserTerm, searchUsers]);

  const handleStartNewChat = async (participantId) => {
    try {
      const conv = await messagingService.startConversation(participantId);
      setIsSearchOpen(false);
      setSearchUserTerm('');

      // Check if conversation already in our list
      const existing = conversations.find(c => c.id === conv.id);
      if (existing) {
        setSelectedConversation(existing);
      } else {
        // Refresh list and select it
        await fetchConversations();
        const freshData = await messagingService.getConversations();
        const newConv = freshData.find(c => c.id === conv.id);
        if (newConv) setSelectedConversation(newConv);
      }
    } catch (err) {
      console.error('Error starting new chat:', err);
    }
  };

  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      if (behavior === 'auto') {
        container.scrollTop = container.scrollHeight;
      } else {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  };

  // Scroll to bottom on initial message load (instant)
  useEffect(() => {
    if (messages.length > 0 && msgLoading === false) {
      scrollToBottom('auto');
    }
  }, [selectedConversation?.id, msgLoading, messages.length]);

  // Scroll to bottom on new messages (smooth)
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom('smooth');
    }
  }, [messages.length]);

  const handleSendMessage = async () => {
    if (newMessage.trim() && selectedConversation) {
      const content = newMessage;
      const tempId = `temp-${Date.now()}`;

      // 1. Optimistic Update (Immediate Feedback)
      const optimisticMsg = {
        id: tempId,
        sender_id: user.id,
        content: content,
        created_at: new Date().toISOString(),
        is_temp: true
      };

      setMessages(prev => [...prev, optimisticMsg]);
      setNewMessage('');

      try {
        const sentMsg = await messagingService.sendMessage(selectedConversation.id, content);

        // 2. Replace optimistic message with actual server message
        // Check if realtime already added the message to avoid duplication
        setMessages(prev => {
          if (prev.some(m => m.id === sentMsg.id)) {
            return prev.filter(m => m.id !== tempId);
          }
          return prev.map(m => m.id === tempId ? sentMsg : m);
        });

        // 3. Update conversation last message preview
        setConversations(prev => prev.map(c =>
          c.id === selectedConversation.id
            ? { ...c, last_message: content, last_message_at: sentMsg.created_at }
            : c
        ));
      } catch (err) {
        console.error('Error sending message:', err);
        // Remove the optimistic message on failure
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setNewMessage(content); // Restore content so user doesn't lose it
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.participant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (conv.last_message && conv.last_message.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString();
    }
  };

  if (!user) return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Typography>Please log in to view messages.</Typography>
    </Box>
  );

  return (
    <Box sx={{
      height: 'calc(100vh - var(--app-header-height, 64px))',
      backgroundColor: '#f8fafc',
      p: { xs: 1, md: 1.5 },
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Header Section - More stable rendering */}
      {(!isMobile || !selectedConversation) && (
        <Box sx={{
          maxWidth: '1400px',
          width: '100%',
          mx: 'auto',
          mb: { xs: 1.2, md: 2.5 },
          flexShrink: 0
        }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  color: '#1e293b',
                  fontSize: { xs: '1.1rem', md: '1.3rem' },
                  mb: 0.2
                }}
              >
                Messages
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', opacity: 0.8 }}>
                Real-time communication with users
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="small"
              startIcon={<Add />}
              onClick={() => setIsSearchOpen(true)}
              sx={{
                bgcolor: '#4caf50',
                '&:hover': { bgcolor: '#45a049' },
                borderRadius: 1.5,
                textTransform: 'none',
                px: 2
              }}
            >
              New Chat
            </Button>
          </Stack>
        </Box>
      )}

      {/* Main Chat Interface - Compacted */}
      <Box sx={{
        maxWidth: '1400px',
        width: '100%',
        mx: 'auto',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        mb: { xs: 1, md: 2 } // Give breathing room at the bottom
      }}>
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            minHeight: 0,
            border: '1px solid #e2e8f0',
            borderRadius: 2,
            backgroundColor: 'white',
            overflow: 'hidden',
            display: 'flex',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
          }}
        >
          {/* Conversations Sidebar - Thinner */}
          <Box sx={{
            width: { xs: '100%', md: '340px' },
            borderRight: '1px solid #e2e8f0',
            height: '100%',
            display: { xs: selectedConversation ? 'none' : 'flex', md: 'flex' },
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <Box sx={{
              p: 2,
              borderBottom: '1px solid #e2e8f0',
              backgroundColor: '#fafbfc',
              flexShrink: 0
            }}>
              <TextField
                fullWidth
                placeholder="Search chats..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ fontSize: 16, color: '#64748b' }} />
                    </InputAdornment>
                  ),
                }}
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1.5,
                    backgroundColor: 'white',
                    fontSize: '0.8rem',
                    height: '36px'
                  }
                }}
              />
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {loading ? (
                <Stack alignItems="center" p={4}><CircularProgress size={24} /></Stack>
              ) : filteredConversations.length > 0 ? (
                filteredConversations.map((conv) => (
                  <Box
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      borderBottom: '1px solid #f8fafc',
                      backgroundColor: selectedConversation?.id === conv.id ? '#f0fdf4' : 'transparent',
                      borderLeft: selectedConversation?.id === conv.id ? '3px solid #4caf50' : '3px solid transparent',
                      transition: 'all 0.1s ease',
                      '&:hover': { backgroundColor: selectedConversation?.id === conv.id ? '#f0fdf4' : '#f8fafc' }
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar
                        src={conv.participant_avatar}
                        sx={{
                          width: 38,
                          height: 38,
                          fontSize: '0.9rem',
                          bgcolor: isAdmin(conv.participant_type) ? '#0d9488' : conv.participant_type === 'farmer' ? '#dcfce7' : '#dbeafe',
                          color: isAdmin(conv.participant_type) ? '#fff' : conv.participant_type === 'farmer' ? '#059669' : '#1d4ed8',
                        }}
                      >
                        {isAdmin(conv.participant_type) ? 'S' : conv.participant_name.charAt(0)}
                      </Avatar>

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: '#1e293b', fontSize: '0.875rem' }}>
                            {displayName(conv.participant_name, conv.participant_type)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                            {formatTime(conv.last_message_at)}
                          </Typography>
                        </Stack>

                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                          <Typography variant="body2" noWrap sx={{ fontSize: '0.75rem', color: '#64748b', flex: 1, opacity: conv.unread_count > 0 ? 1 : 0.8, fontWeight: conv.unread_count > 0 ? 500 : 400 }}>
                            {conv.last_message || 'No messages yet'}
                          </Typography>
                          {conv.unread_count > 0 && (
                            <Box sx={{ bgcolor: '#4caf50', color: 'white', borderRadius: '10px', px: 0.8, py: 0.1, fontSize: '0.7rem', fontWeight: 700 }}>
                              {conv.unread_count}
                            </Box>
                          )}
                        </Stack>
                      </Box>
                    </Stack>
                  </Box>
                ))
              ) : (
                <Box p={4} textAlign="center">
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>No conversations.</Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Chat Area */}
          <Box sx={{
            flex: 1,
            flexDirection: 'column',
            height: '100%',
            display: { xs: selectedConversation ? 'flex' : 'none', md: 'flex' }
          }}>
            {selectedConversation ? (
              <>
                {/* Chat Header - Compact and Sticky */}
                <Box sx={{
                  p: 1.5,
                  borderBottom: '1px solid #e2e8f0',
                  backgroundColor: 'white',
                  flexShrink: 0,
                  zIndex: 10,
                  // Ensure it stays at top of Paper and below Nav Header
                  position: 'sticky',
                  top: 0
                }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      {isMobile && (
                        <IconButton
                          size="small"
                          onClick={() => setSelectedConversation(null)}
                          sx={{ mr: 0.5 }}
                        >
                          <ArrowBack sx={{ fontSize: 20 }} />
                        </IconButton>
                      )}
                      <Avatar
                        src={selectedConversation.participant_avatar}
                        sx={{
                          width: 36,
                          height: 36,
                          fontSize: '0.9rem',
                          bgcolor: isAdmin(selectedConversation.participant_type) ? '#0d9488' : selectedConversation.participant_type === 'farmer' ? '#dcfce7' : '#dbeafe',
                          color: isAdmin(selectedConversation.participant_type) ? '#fff' : selectedConversation.participant_type === 'farmer' ? '#059669' : '#1d4ed8'
                        }}
                      >
                        {isAdmin(selectedConversation.participant_type) ? 'S' : selectedConversation.participant_name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                            {displayName(selectedConversation.participant_name, selectedConversation.participant_type)}
                          </Typography>
                          {isAdmin(selectedConversation.participant_type) && <VerifiedUser sx={{ fontSize: 16, color: '#0d9488' }} />}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          {isAdmin(selectedConversation.participant_type) ? 'Verified Support' : selectedConversation.participant_type.charAt(0).toUpperCase() + selectedConversation.participant_type.slice(1)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Stack>
                </Box>

                <Box
                  ref={messagesContainerRef}
                  sx={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    p: 2,
                    backgroundColor: '#f8fafc',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundImage: 'radial-gradient(#e2e8f0 0.5px, transparent 0.5px)',
                    backgroundSize: '20px 20px',
                  }}
                >
                  {msgLoading && messages.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress size={20} /></Box>
                  ) : (
                    messages.map((msg, idx) => {
                      const isMe = msg.sender_id === user.id;
                      const fromAdmin = !isMe && isAdmin(selectedConversation.participant_type);
                      return (
                        <Box
                          key={msg.id}
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isMe ? 'flex-end' : 'flex-start',
                            mb: 1.5
                          }}
                        >
                          {fromAdmin && (
                            <Typography variant="caption" sx={{ color: '#0d9488', fontWeight: 600, fontSize: '0.65rem', mb: 0.2, ml: 0.5 }}>
                              Share-Crop Support
                            </Typography>
                          )}
                          <Box
                            sx={{
                              maxWidth: '80%',
                              p: 1.2,
                              px: 1.8,
                              borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                              backgroundColor: isMe ? '#4caf50' : 'white',
                              color: isMe ? 'white' : '#1e293b',
                              border: isMe ? 'none' : '1px solid #e2e8f0',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                              position: 'relative'
                            }}
                          >
                            <Typography sx={{ fontSize: '0.8125rem', lineHeight: 1.45 }}>
                              {msg.content}
                            </Typography>
                            <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={0.5} sx={{ mt: 0.2 }}>
                              <Typography variant="caption" sx={{ fontSize: '0.65rem', opacity: 0.7 }}>
                                {formatTime(msg.created_at)}
                              </Typography>
                              {isMe && (
                                <Box sx={{ opacity: 0.9, height: 14 }}>
                                  {msg.is_temp ? <Schedule sx={{ fontSize: 10 }} /> : <DoneAll sx={{ fontSize: 13, color: msg.is_read ? '#fff' : 'rgba(255,255,255,0.6)' }} />}
                                </Box>
                              )}
                            </Stack>
                          </Box>
                        </Box>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </Box>

                {/* Message Input - Compact */}
                <Box sx={{ p: 1.5, px: 2, borderTop: '1px solid #e2e8f0', backgroundColor: 'white' }}>
                  <Stack direction="row" spacing={1} alignItems="flex-end">
                    <TextField
                      fullWidth
                      multiline
                      maxRows={4}
                      placeholder="Write message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          backgroundColor: '#f1f5f9',
                          fontSize: '0.85rem',
                        }
                      }}
                    />
                    <IconButton
                      disabled={!newMessage.trim()}
                      onClick={handleSendMessage}
                      sx={{
                        bgcolor: '#4caf50',
                        color: 'white',
                        '&:hover': { bgcolor: '#45a049' },
                        '&.Mui-disabled': { bgcolor: '#f1f5f9', color: '#cbd5e1' },
                        width: 38,
                        height: 38
                      }}
                    >
                      <Send sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Stack>
                </Box>
              </>
            ) : (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafbfc' }}>
                <Box sx={{ textAlign: 'center', opacity: 0.5 }}>
                  <ChatBubbleOutline sx={{ fontSize: 48, mb: 1.5 }} />
                  <Typography variant="subtitle2">Select a conversation to start</Typography>
                </Box>
              </Box>
            )}
          </Box>
        </Paper>
      </Box>

      {/* New Chat Dialog - Slightly smaller */}
      <Dialog open={isSearchOpen} onClose={() => setIsSearchOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.1rem' }}>New Conversation</DialogTitle>
        <DialogContent sx={{ minHeight: '300px', p: 1.5 }}>
          <TextField
            fullWidth
            autoFocus
            placeholder="Search by name..."
            value={searchUserTerm}
            onChange={(e) => setSearchUserTerm(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 20 }} /></InputAdornment>,
              endAdornment: searching && <CircularProgress size={16} />
            }}
            size="small"
          />
          <List sx={{ mt: 1 }}>
            {foundUsers.map(u => (
              <ListItem
                key={u.id}
                button
                dense
                onClick={() => handleStartNewChat(u.id)}
                sx={{ borderRadius: 1.5, mb: 0.5 }}
              >
                <ListItemAvatar>
                  <Avatar
                    src={u.profile_image_url}
                    sx={{ width: 34, height: 34, fontSize: '0.875rem', bgcolor: isAdmin(u.user_type) ? '#0d9488' : '#4caf50' }}
                  >
                    {!u.profile_image_url && u.name.charAt(0)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{displayName(u.name, u.user_type)}</Typography>}
                  secondary={<Typography variant="caption">{u.user_type === 'admin' ? 'Support' : u.user_type}</Typography>}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default Messages;