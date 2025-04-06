// Category management utility
import { useState, useEffect } from 'react';

// Default categories to start with
const DEFAULT_CATEGORIES = [
  '과일류',
  '채소류',
  '육류',
  '해산물',
  '가공식품',
  '생활용품',
  '주방용품',
  '의류',
  '전자제품',
  '기타'
];

// Local storage key
const STORAGE_KEY = 'productCategories';

// Load categories from localStorage
export function loadCategories(): string[] {
  try {
    const savedCategories = localStorage.getItem(STORAGE_KEY);
    if (savedCategories) {
      const parsed = JSON.parse(savedCategories);
      if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load categories from localStorage:', e);
  }
  
  // Return default categories if nothing valid in localStorage
  return DEFAULT_CATEGORIES;
}

// Save categories to localStorage
export function saveCategories(categories: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  } catch (e) {
    console.error('Failed to save categories to localStorage:', e);
  }
}

// Add a new category
export function addCategory(newCategory: string): string[] {
  const categories = loadCategories();
  // Only add if it doesn't already exist
  if (!categories.includes(newCategory)) {
    const updatedCategories = [...categories, newCategory];
    saveCategories(updatedCategories);
    return updatedCategories;
  }
  return categories;
}

// Remove a category
export function removeCategory(categoryToRemove: string): string[] {
  const categories = loadCategories();
  const updatedCategories = categories.filter(cat => cat !== categoryToRemove);
  saveCategories(updatedCategories);
  return updatedCategories;
}

// React hook for managing categories
export function useCategories() {
  const [categories, setCategories] = useState<string[]>([]);
  
  // Load categories on initial mount
  useEffect(() => {
    setCategories(loadCategories());
  }, []);
  
  // Add a new category
  const addNewCategory = (newCategory: string) => {
    if (!newCategory.trim()) return;
    
    const updatedCategories = addCategory(newCategory.trim());
    setCategories(updatedCategories);
  };
  
  // Remove a category
  const deleteCategory = (categoryToRemove: string) => {
    const updatedCategories = removeCategory(categoryToRemove);
    setCategories(updatedCategories);
  };
  
  // Reorder categories
  const reorderCategories = (newOrder: string[]) => {
    saveCategories(newOrder);
    setCategories(newOrder);
  };
  
  return {
    categories,
    addNewCategory,
    deleteCategory,
    reorderCategories,
    setCategories
  };
}
