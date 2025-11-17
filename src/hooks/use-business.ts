import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export interface Business {
  id: string;
  name: string;
  description?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  industry?: string;
  size?: string;
  logo?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export function useBusiness() {
  const { data: session } = useSession();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load businesses for current user
  const loadBusinesses = async () => {
    if (!session?.user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/businesses');
      if (!response.ok) throw new Error('Failed to load businesses');

      const data = await response.json();
      setBusinesses(data.businesses || []);
      
      // Auto-select first business if none selected
      if (!selectedBusiness && data.businesses?.length > 0) {
        setSelectedBusiness(data.businesses[0]);
      }
    } catch (err) {
      console.error('Error loading businesses:', err);
      setError(err instanceof Error ? err.message : 'Failed to load businesses');
    } finally {
      setLoading(false);
    }
  };

  // Create new business
  const createBusiness = async (businessData: Partial<Business>) => {
    if (!session?.user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/businesses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(businessData),
      });

      if (!response.ok) throw new Error('Failed to create business');

      const newBusiness = await response.json();
      setBusinesses(prev => [...prev, newBusiness]);
      setSelectedBusiness(newBusiness);
      
      return newBusiness;
    } catch (err) {
      console.error('Error creating business:', err);
      setError(err instanceof Error ? err.message : 'Failed to create business');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update business
  const updateBusiness = async (businessId: string, updates: Partial<Business>) => {
    if (!session?.user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/businesses/${businessId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update business');

      const updatedBusiness = await response.json();
      setBusinesses(prev => 
        prev.map(business => 
          business.id === businessId ? updatedBusiness : business
        )
      );
      
      if (selectedBusiness?.id === businessId) {
        setSelectedBusiness(updatedBusiness);
      }
      
      return updatedBusiness;
    } catch (err) {
      console.error('Error updating business:', err);
      setError(err instanceof Error ? err.message : 'Failed to update business');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Delete business
  const deleteBusiness = async (businessId: string) => {
    if (!session?.user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/businesses/${businessId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete business');

      setBusinesses(prev => prev.filter(business => business.id !== businessId));
      
      if (selectedBusiness?.id === businessId) {
        setSelectedBusiness(businesses.find(b => b.id !== businessId) || null);
      }
    } catch (err) {
      console.error('Error deleting business:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete business');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Load businesses on mount and when session changes
  useEffect(() => {
    loadBusinesses();
  }, [session?.user?.id]);

  return {
    businesses,
    selectedBusiness,
    loading,
    error,
    
    // Actions
    setSelectedBusiness,
    loadBusinesses,
    createBusiness,
    updateBusiness,
    deleteBusiness,
  };
}