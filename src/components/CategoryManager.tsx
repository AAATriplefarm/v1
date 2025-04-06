import React, { useState, useRef } from 'react';
import { PlusCircle, X, Save, ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import { useCategories } from '../utils/categoryManager';

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CategoryManager({ isOpen, onClose }: CategoryManagerProps) {
  const { categories, addNewCategory, deleteCategory, reorderCategories } = useCategories();
  const [newCategory, setNewCategory] = useState('');
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const dragOverItemIndex = useRef<number | null>(null);

  // Initialize local categories when modal opens or categories change
  React.useEffect(() => {
    setLocalCategories([...categories]);
    setIsDirty(false);
  }, [categories, isOpen]);

  const handleAddCategory = () => {
    if (newCategory.trim()) {
      const updatedCategories = [...localCategories, newCategory.trim()];
      setLocalCategories(updatedCategories);
      setNewCategory('');
      setIsDirty(true);
    }
  };

  const handleDeleteCategory = (index: number) => {
    const updatedCategories = localCategories.filter((_, i) => i !== index);
    setLocalCategories(updatedCategories);
    setIsDirty(true);
  };

  const handleSaveChanges = () => {
    reorderCategories(localCategories);
    setIsDirty(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddCategory();
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updatedCategories = [...localCategories];
    [updatedCategories[index - 1], updatedCategories[index]] = 
      [updatedCategories[index], updatedCategories[index - 1]];
    setLocalCategories(updatedCategories);
    setIsDirty(true);
  };

  const handleMoveDown = (index: number) => {
    if (index === localCategories.length - 1) return;
    const updatedCategories = [...localCategories];
    [updatedCategories[index], updatedCategories[index + 1]] = 
      [updatedCategories[index + 1], updatedCategories[index]];
    setLocalCategories(updatedCategories);
    setIsDirty(true);
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverItemIndex.current = index;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null || dragOverItemIndex.current === null) return;
    
    const newCategories = [...localCategories];
    const draggedItem = newCategories[draggedIndex];
    
    // Remove the dragged item
    newCategories.splice(draggedIndex, 1);
    
    // Insert at the new position
    newCategories.splice(dragOverItemIndex.current, 0, draggedItem);
    
    setLocalCategories(newCategories);
    setDraggedIndex(null);
    dragOverItemIndex.current = null;
    setIsDirty(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">카테고리 관리</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="새 카테고리 이름"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleAddCategory}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              <PlusCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            카테고리를 드래그하거나 화살표 버튼을 사용하여 순서를 변경할 수 있습니다.
          </p>
        </div>

        <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md mb-4">
          {localCategories.length === 0 ? (
            <p className="text-center py-4 text-gray-500">카테고리가 없습니다. 새 카테고리를 추가하세요.</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {localCategories.map((category, index) => (
                <li 
                  key={index} 
                  className={`flex items-center p-3 hover:bg-gray-50 ${draggedIndex === index ? 'bg-blue-50' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={handleDrop}
                >
                  <div className="cursor-grab text-gray-400 mr-2">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <span className="flex-1">{category}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className={`p-1 text-gray-500 hover:text-gray-700 ${index === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === localCategories.length - 1}
                      className={`p-1 text-gray-500 hover:text-gray-700 ${index === localCategories.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(index)}
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSaveChanges}
            disabled={!isDirty}
            className={`px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 flex items-center gap-2 ${!isDirty ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Save className="w-4 h-4" />
            변경사항 저장
          </button>
        </div>
      </div>
    </div>
  );
}
