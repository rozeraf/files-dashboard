// web/src/App.tsx
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Shell } from '@/components/layout/Shell'

const HomePage = lazy(() => import('@/pages/HomePage').then(m => ({ default: m.HomePage })))
const LibraryPage = lazy(() => import('@/pages/LibraryPage').then(m => ({ default: m.LibraryPage })))
const CategoryPage = lazy(() => import('@/pages/CategoryPage').then(m => ({ default: m.CategoryPage })))
const CollectionsPage = lazy(() => import('@/pages/CollectionsPage').then(m => ({ default: m.CollectionsPage })))
const CollectionDetailPage = lazy(() => import('@/pages/CollectionDetailPage').then(m => ({ default: m.CollectionDetailPage })))
const TagsPage = lazy(() => import('@/pages/TagsPage').then(m => ({ default: m.TagsPage })))
const SavedViewsPage = lazy(() => import('@/pages/SavedViewsPage').then(m => ({ default: m.SavedViewsPage })))
const RecentPage = lazy(() => import('@/pages/RecentPage').then(m => ({ default: m.RecentPage })))
const FavoritesPage = lazy(() => import('@/pages/FavoritesPage').then(m => ({ default: m.FavoritesPage })))
const UncategorizedPage = lazy(() => import('@/pages/UncategorizedPage').then(m => ({ default: m.UncategorizedPage })))
const FilesPage = lazy(() => import('@/pages/FilesPage').then(m => ({ default: m.FilesPage })))
const SearchPage = lazy(() => import('@/pages/SearchPage').then(m => ({ default: m.SearchPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })))

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<Suspense><HomePage /></Suspense>} />
          <Route path="/libraries/:libraryId" element={<Suspense><LibraryPage /></Suspense>} />
          <Route path="/categories/:categoryId" element={<Suspense><CategoryPage /></Suspense>} />
          <Route path="/collections" element={<Suspense><CollectionsPage /></Suspense>} />
          <Route path="/collections/:collectionId" element={<Suspense><CollectionDetailPage /></Suspense>} />
          <Route path="/tags" element={<Suspense><TagsPage /></Suspense>} />
          <Route path="/saved-views" element={<Suspense><SavedViewsPage /></Suspense>} />
          <Route path="/recent" element={<Suspense><RecentPage /></Suspense>} />
          <Route path="/favorites" element={<Suspense><FavoritesPage /></Suspense>} />
          <Route path="/uncategorized" element={<Suspense><UncategorizedPage /></Suspense>} />
          <Route path="/files" element={<Suspense><FilesPage /></Suspense>} />
          <Route path="/search" element={<Suspense><SearchPage /></Suspense>} />
          <Route path="/settings" element={<Suspense><SettingsPage /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
