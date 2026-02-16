import React, { useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    IconButton,
    Divider,
    Chip,
    Button,
    Avatar,
    Stack,
    Tooltip,
} from '@mui/material';
import {
    Notifications as NotificationsIcon,
    NotificationsNone,
    Delete,
    CheckCircle,
    Info,
    Warning,
    Error as ErrorIcon,
    AccessTime,
    DoneAll,
} from '@mui/icons-material';
import useNotifications from '../hooks/useNotifications';
import { useAuth } from '../contexts/AuthContext';

const NotificationsPage = () => {
    const { user } = useAuth();
    const {
        backendNotifications,
        markNotificationAsRead,
        fetchBackendNotifications,
    } = useNotifications();

    useEffect(() => {
        fetchBackendNotifications();
    }, [fetchBackendNotifications]);

    const getIcon = (type, read) => {
        const color = read ? 'action' : type || 'info';
        switch (type) {
            case 'success':
                return <CheckCircle color={color} />;
            case 'warning':
                return <Warning color={color} />;
            case 'error':
                return <ErrorIcon color={color} />;
            default:
                return <Info color={color} />;
        }
    };

    const getBackgroundColor = (type, read) => {
        if (read) return 'transparent';
        switch (type) {
            case 'success':
                return 'rgba(76, 175, 80, 0.05)';
            case 'warning':
                return 'rgba(255, 152, 0, 0.05)';
            case 'error':
                return 'rgba(244, 67, 54, 0.05)';
            default:
                return 'rgba(33, 150, 243, 0.05)';
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    const handleMarkAllAsRead = () => {
        backendNotifications.forEach((notif) => {
            if (!notif.read) {
                markNotificationAsRead(notif.id);
            }
        });
    };

    return (
        <Box sx={{
            minHeight: '100vh',
            backgroundColor: '#f8fafc',
            p: { xs: 2, md: 4 }
        }}>
            <Box sx={{ maxWidth: '800px', mx: 'auto' }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 4 }}>
                    <Box>
                        <Typography variant="h4" sx={{ fontWeight: 800, color: '#1e293b', mb: 1 }}>
                            Notifications
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Stay updated with your latest activities and alerts
                        </Typography>
                    </Box>
                    {backendNotifications.some(n => !n.read) && (
                        <Button
                            startIcon={<DoneAll />}
                            onClick={handleMarkAllAsRead}
                            sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                color: '#4caf50',
                                '&:hover': { backgroundColor: 'rgba(76, 175, 80, 0.08)' }
                            }}
                        >
                            Mark all as read
                        </Button>
                    )}
                </Stack>

                <Paper
                    elevation={0}
                    sx={{
                        borderRadius: 4,
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden',
                        backgroundColor: 'white'
                    }}
                >
                    {backendNotifications.length === 0 ? (
                        <Box sx={{ py: 12, textAlign: 'center' }}>
                            <Avatar
                                sx={{
                                    width: 80,
                                    height: 80,
                                    backgroundColor: '#f1f5f9',
                                    color: '#94a3b8',
                                    mx: 'auto',
                                    mb: 3
                                }}
                            >
                                <NotificationsNone sx={{ fontSize: 40 }} />
                            </Avatar>
                            <Typography variant="h6" sx={{ color: '#1e293b', mb: 1 }}>
                                All caught up!
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                You don't have any notifications at the moment.
                            </Typography>
                        </Box>
                    ) : (
                        <List sx={{ p: 0 }}>
                            {backendNotifications.map((notification, index) => (
                                <React.Fragment key={notification.id}>
                                    <ListItem
                                        sx={{
                                            py: 3,
                                            px: 3,
                                            backgroundColor: getBackgroundColor(notification.type, notification.read),
                                            transition: 'background-color 0.2s',
                                            position: 'relative',
                                            '&:hover': {
                                                backgroundColor: notification.read ? '#f8fafc' : getBackgroundColor(notification.type, notification.read)
                                            }
                                        }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 56 }}>
                                            <Avatar
                                                sx={{
                                                    backgroundColor: notification.read ? '#f1f5f9' : 'white',
                                                    boxShadow: notification.read ? 'none' : '0 2px 8px rgba(0,0,0,0.05)',
                                                    width: 44,
                                                    height: 44
                                                }}
                                            >
                                                {getIcon(notification.type, notification.read)}
                                            </Avatar>
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={
                                                <Typography
                                                    variant="subtitle1"
                                                    sx={{
                                                        fontWeight: notification.read ? 500 : 700,
                                                        color: '#1e293b',
                                                        lineHeight: 1.4,
                                                        mb: 0.5
                                                    }}
                                                >
                                                    {notification.message}
                                                </Typography>
                                            }
                                            secondary={
                                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                                                    <AccessTime sx={{ fontSize: 14, color: '#94a3b8' }} />
                                                    <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 500 }}>
                                                        {formatTime(notification.created_at || notification.timestamp)}
                                                    </Typography>
                                                    {!notification.read && (
                                                        <Chip
                                                            label="New"
                                                            size="small"
                                                            sx={{
                                                                height: 20,
                                                                fontSize: '10px',
                                                                fontWeight: 800,
                                                                backgroundColor: '#4caf50',
                                                                color: 'white'
                                                            }}
                                                        />
                                                    )}
                                                </Stack>
                                            }
                                        />
                                        {!notification.read && (
                                            <Tooltip title="Mark as read">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => markNotificationAsRead(notification.id)}
                                                    sx={{
                                                        color: '#94a3b8',
                                                        '&:hover': { color: '#4caf50', backgroundColor: 'rgba(76, 175, 80, 0.08)' }
                                                    }}
                                                >
                                                    <CheckCircle sx={{ fontSize: 20 }} />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </ListItem>
                                    {index < backendNotifications.length - 1 && <Divider sx={{ opacity: 0.6 }} />}
                                </React.Fragment>
                            ))}
                        </List>
                    )}
                </Paper>
            </Box>
        </Box>
    );
};

export default NotificationsPage;
