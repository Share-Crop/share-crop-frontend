import React, { useState, useEffect } from 'react';
import { Grid, Card, CardContent, Typography, Box, Button, Chip } from '@mui/material';
import { ShoppingCart, AccountBalance, History, LocationOn } from '@mui/icons-material';
import { orderService } from '../../services/orders';
import { userService } from '../../services/users';
import storageService from '../../services/storage';
import Loader from '../Common/Loader';
import ErrorMessage from '../Common/ErrorMessage';

const BuyerDashboard = ({ user }) => {
  const [orders, setOrders] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load orders from persistent storage first
      const storedOrders = storageService.getUserOrders();
      
      if (storedOrders && storedOrders.length > 0) {
        // Convert stored orders to the expected format
        const formattedOrders = storedOrders.map(order => ({
          id: order.id,
          product_name: order.productName || order.farmName || 'Unknown Product',
          total_cost: order.totalCost || order.totalAmount || 0,
          status: order.status || 'pending',
          created_at: order.created_at || order.orderDate || new Date().toISOString()
        }));
        
        setOrders(formattedOrders);
        
        // For balance, try to get from API or use default
        try {
          const balanceResponse = await userService.getBalance();
          setBalance(balanceResponse.data.balance);
        } catch (balanceError) {
          setBalance(10000); // Default balance
        }
        
        setError(null);
        setLoading(false);
        return;
      }
      
      // Fallback to API services if no stored orders
      const [ordersResponse, balanceResponse] = await Promise.all([
        orderService.getBuyerOrders(),
        userService.getBalance()
      ]);
      setOrders(ordersResponse.data.orders);
      setBalance(balanceResponse.data.balance);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader message="Loading your dashboard..." />;
  if (error) return <ErrorMessage message={error} onRetry={loadDashboardData} />;

  const recentOrders = orders.slice(0, 3);
  const totalSpent = orders.reduce((sum, order) => sum + order.total_cost, 0);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        🛒 Buyer Dashboard
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Balance Card */}
        <Grid item xs={12} md={4}>
          <Card className="farmville-card">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AccountBalance sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Farm Coins</Typography>
              </Box>
              <Typography variant="h4" color="primary.main" gutterBottom>
                {balance.toLocaleString()}
              </Typography>
              <Button variant="outlined" size="small">
                Add Coins
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Orders Card */}
        <Grid item xs={12} md={4}>
          <Card className="farmville-card">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ShoppingCart sx={{ mr: 1, color: 'secondary.main' }} />
                <Typography variant="h6">Total Orders</Typography>
              </Box>
              <Typography variant="h4" color="secondary.main" gutterBottom>
                {orders.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ${totalSpent.toFixed(2)} spent
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Active Rentals Card */}
        <Grid item xs={12} md={4}>
          <Card className="farmville-card">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <LocationOn sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6">Active Rentals</Typography>
              </Box>
              <Typography variant="h4" color="success.main" gutterBottom>
                {orders.filter(o => o.status === 'confirmed').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Currently renting
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Orders */}
      <Card className="farmville-card">
        <CardContent>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <History sx={{ mr: 1 }} />
            Recent Orders
          </Typography>
          
          {recentOrders.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No orders yet. Start shopping in the marketplace!
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {recentOrders.map((order) => (
                <Grid item xs={12} key={order.id}>
                  <Box sx={{ 
                    p: 2, 
                    border: '1px solid',
                    borderColor: 'grey.200',
                    borderRadius: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <Box>
                      <Typography variant="subtitle1">{order.product_name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {order.area_rented}m² • ${order.total_cost}
                      </Typography>
                    </Box>
                    <Chip 
                      label={order.status} 
                      color={
                        order.status === 'completed' ? 'success' :
                        order.status === 'shipped' ? 'info' :
                        order.status === 'active' || order.status === 'confirmed' ? 'primary' : 'default'
                      }
                    />
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default BuyerDashboard;