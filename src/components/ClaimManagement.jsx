import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import { Assignment, CheckCircle, Error, Schedule } from '@mui/icons-material';

const ClaimManagement = () => {
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const [claims, setClaims] = useState([]);
  const [investigators, setInvestigators] = useState([]);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch claims
  const fetchClaims = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/claims`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      const data = await response.json();
      setClaims(data);
    } catch (error) {
      console.error('Error fetching claims:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch investigators
  const fetchInvestigators = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/users?role=INVESTIGATOR`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      const data = await response.json();
      setInvestigators(data);
    } catch (error) {
      console.error('Error fetching investigators:', error);
    }
  };

  useEffect(() => {
    fetchClaims();
    fetchInvestigators();
  }, []);

  // Listen for claim updates via socket
  useEffect(() => {
    if (socket) {
      socket.on('claimAssigned', () => {
        fetchClaims(); // Refresh claims when one is assigned
      });
    }
  }, [socket]);

  const handleAssign = async (investigatorId) => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/claims/${selectedClaim.ClaimId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ investigatorId })
      });

      if (response.ok) {
        // Emit socket event for real-time update
        socket.emit('assignClaim', {
          claimId: selectedClaim.ClaimId,
          investigatorId
        });
        
        // Refresh claims list
        await fetchClaims();
        setAssignDialogOpen(false);
      }
    } catch (error) {
      console.error('Error assigning claim:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInvestigatorStatus = (investigator) => {
    const isOnline = onlineUsers.some(user => user.userId === investigator.id);
    return {
      online: isOnline,
      lastSeen: investigator.lastLogin
    };
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'New': return 'error';
      case 'Assigned': return 'warning';
      case 'Completed': return 'success';
      case 'Closed': return 'default';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {claims.map(claim => (
        <Card key={claim.ClaimId} sx={{ mb: 2 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">
                {claim.ClaimNumber}
                <Chip 
                  label={claim.ClaimStatus}
                  color={getStatusColor(claim.ClaimStatus)}
                  size="small"
                  sx={{ ml: 1 }}
                />
              </Typography>
              {claim.ClaimStatus === 'New' && (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<Assignment />}
                  onClick={() => {
                    setSelectedClaim(claim);
                    setAssignDialogOpen(true);
                  }}
                  disabled={loading}
                >
                  Assign Investigator
                </Button>
              )}
            </Box>
            
            <Typography variant="body2" color="textSecondary">
              Vehicle: {claim.VehicleNumber} - {claim.VehicleType}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Policy: {claim.PolicyNumber}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Created: {formatDate(claim.CreatedAt)}
            </Typography>
            {claim.InvestigatorId && (
              <Typography variant="body2" color="textSecondary">
                Assigned: {formatDate(claim.AssignedAt)}
              </Typography>
            )}
            {claim.SupervisorNotes && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Notes: {claim.SupervisorNotes}
              </Typography>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)}>
        <DialogTitle>Assign Investigator</DialogTitle>
        <DialogContent>
          <List>
            {investigators.map(investigator => {
              const status = getInvestigatorStatus(investigator);
              return (
                <ListItem key={investigator.id}>
                  <ListItemText
                    primary={investigator.name}
                    secondary={`Last active: ${formatDate(investigator.lastLogin)}`}
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title={status.online ? 'Online' : 'Offline'}>
                      <IconButton edge="end" sx={{ mr: 1 }}>
                        {status.online ? (
                          <CheckCircle color="success" />
                        ) : (
                          <Schedule color="disabled" />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => handleAssign(investigator.id)}
                      disabled={loading}
                    >
                      Assign
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>
              );
            })}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClaimManagement;
