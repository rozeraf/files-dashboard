// web/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Shell } from '@/components/layout/Shell'
import { HomePage } from '@/pages/HomePage'
import { LibraryPage } from '@/pages/LibraryPage'
import { CategoryPage } from '@/pages/CategoryPage'
import { CollectionsPage } from '@/pages/CollectionsPage'
import { CollectionDetailPage } from '@/pages/CollectionDetailPage'
import { TagsPage } from '@/pages/TagsPage'
import { SavedViewsPage } from '@/pages/SavedViewsPage'
import { RecentPage } from '@/pages/RecentPage'
import { FavoritesPage } from '@/pages/FavoritesPage'
import { UncategorizedPage } from '@/pages/UncategorizedPage'
import { FilesPage } from '@/pages/FilesPage'
import { SearchPage } from '@/pages/SearchPage'
import { SettingsPage } from '@/pages/SettingsPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/libraries/:libraryId" element={<LibraryPage />} />
          <Route path="/categories/:categoryId" element={<CategoryPage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/collections/:collectionId" element={<CollectionDetailPage />} />
          <Route path="/tags" element={<TagsPage />} />
          <Route path="/saved-views" element={<SavedViewsPage />} />
          <Route path="/recent" element={<RecentPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/uncategorized" element={<UncategorizedPage />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
