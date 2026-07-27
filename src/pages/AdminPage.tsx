import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BlogAdmin, { type AdminTab } from '../components/BlogAdmin';

const PATH_TO_TAB: Record<string, AdminTab> = {
  '/dashboard': 'dashboard',
  '/articles': 'articles',
  '/categories': 'categories',
  '/calendar': 'calendar',
  '/comments': 'comments',
  '/newsletter': 'newsletter',
};

export default function AdminPage() {
  const { token } = useAuth();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const tab = PATH_TO_TAB[location.pathname] || 'dashboard';

  return <BlogAdmin initialTab={tab} />;
}
