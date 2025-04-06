import React, { useState, useEffect } from 'react';
import { PlusCircle, Settings, ChevronDown } from 'lucide-react';
import { MatchingRuleGroup, OrderData } from '../types';
import { useCategories } from '../utils/categoryManager';
import { CategoryManager } from './CategoryManager';

interface RuleCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newRuleGroup: MatchingRuleGroup) => void;
  unmatchedItem: OrderData | null;
  existingRule?: MatchingRuleGroup; // 기존 규칙 (수정 모드에서 사용)
  isEditMode?: boolean; // 수정 모드 여부
}

// 필드 정규화 함수 (excelProcessor와 동일하게 유지)
function normalizeFieldValue(value: string | undefined | null): string {
    if (!value) return '';
    return value.trim().toLowerCase();
}

// 주문 식별자 생성 함수 (excelProcessor와 동일하게 유지)
function createOrderIdentifier(order: OrderData): string {
  const normalizedSeller = normalizeFieldValue(order.seller);
  const normalizedProductNumber = normalizeFieldValue(order.productNumber);
  const normalizedProductName = normalizeFieldValue(order.productName);
  const normalizedOptionName = normalizeFieldValue(order.optionName);
  return `${normalizedSeller}|${normalizedProductNumber}|${normalizedProductName}|${normalizedOptionName}`;
}

// 고유 ID 생성 함수
function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function RuleCreationModal({ 
  isOpen, 
  onClose, 
  onSave, 
  unmatchedItem, 
  existingRule, 
  isEditMode = false 
}: RuleCreationModalProps) {
  const { categories, addNewCategory } = useCategories();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customProductName, setCustomProductName] = useState<string>('');
  const [quantityWeight, setQuantityWeight] = useState<number>(1);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState<boolean>(false);
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [specificRuleWeight, setSpecificRuleWeight] = useState<number>(1);

  // 모달이 열릴 때 초기화 또는 기존 값 설정
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && existingRule) {
        // 수정 모드: 기존 규칙 값으로 초기화
        const productName = existingRule.productName;
        
        // 카테고리 목록에 있는지 확인
        if (categories.includes(productName)) {
          setSelectedCategory(productName);
          setShowCustomInput(false);
        } else {
          setCustomProductName(productName);
          setShowCustomInput(true);
        }
        
        // 기본 가중치 설정
        setQuantityWeight(existingRule.quantityWeight || 1);
        
        // 특정 규칙 가중치 설정 (첫 번째 규칙 또는 선택된 규칙)
        if (unmatchedItem) {
          const ruleId = createOrderIdentifier(unmatchedItem);
          const specificWeight = existingRule.ruleWeights && existingRule.ruleWeights[ruleId];
          setSpecificRuleWeight(specificWeight || existingRule.quantityWeight || 1);
        } else {
          setSpecificRuleWeight(existingRule.quantityWeight || 1);
        }
      } else if (unmatchedItem) {
        // 신규 생성 모드: 초기화
        setSelectedCategory('');
        setCustomProductName('');
        setQuantityWeight(1);
        setSpecificRuleWeight(1);
        setShowCustomInput(false);
      }
      
      setIsDropdownOpen(false);
    }
  }, [isOpen, unmatchedItem, existingRule, isEditMode, categories]);

  // 카테고리 관리 모달이 닫힐 때 카테고리 목록 업데이트
  const handleCategoryManagerClose = () => {
    setIsCategoryManagerOpen(false);
    // 카테고리 관리 모달이 닫힐 때 선택된 카테고리가 삭제되었는지 확인
    if (selectedCategory && !categories.includes(selectedCategory)) {
      setSelectedCategory('');
    }
  };

  const handleSave = () => {
    // 수정 모드와 신규 모드 모두 처리
    const targetItem = isEditMode ? existingRule : unmatchedItem;
    if (!targetItem) return;
    
    // 최종 상품명 결정 (카테고리 선택 또는 직접 입력)
    const targetProductName = showCustomInput 
      ? customProductName.trim() 
      : selectedCategory.trim();
    
    if (!targetProductName) {
      alert('대상 상품명을 선택하거나 입력해주세요.');
      return;
    }

    // 직접 입력한 상품명이 새로운 카테고리라면 추가
    if (showCustomInput && customProductName.trim() && !categories.includes(customProductName.trim())) {
      addNewCategory(customProductName.trim());
    }

    let newRuleGroup: MatchingRuleGroup;
    
    if (isEditMode && existingRule) {
      // 수정 모드: 기존 규칙 복사 후 필요한 필드만 업데이트
      newRuleGroup = {
        ...existingRule,
        productName: targetProductName,
        quantityWeight: quantityWeight,
        // 기존 ID 유지
        id: existingRule.id || generateUniqueId()
      };
      
      // 특정 규칙의 가중치 업데이트
      if (unmatchedItem) {
        const ruleId = createOrderIdentifier(unmatchedItem);
        newRuleGroup.ruleWeights = { 
          ...(existingRule.ruleWeights || {}),
          [ruleId]: specificRuleWeight
        };
      }
    } else if (unmatchedItem) {
      // 신규 생성 모드: 새 규칙 생성
      const ruleIdentifier = createOrderIdentifier(unmatchedItem);
      newRuleGroup = {
        productName: targetProductName,
        stock: 0, // 재고 필드는 UI에서 제거했지만 타입 호환성을 위해 기본값 0 설정
        quantityWeight: quantityWeight, // 기본 가중치
        rules: [ruleIdentifier], // 이 미매칭 항목을 위한 규칙 식별자
        // 특정 규칙의 가중치 설정
        ruleWeights: {
          [ruleIdentifier]: specificRuleWeight
        },
        // 고유 ID 생성
        id: generateUniqueId()
      };
    } else {
      return; // 예외 상황
    }
    
    onSave(newRuleGroup);
    onClose();
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setIsDropdownOpen(false);
  };

  if (!isOpen) {
    return null;
  }

  // 원본 데이터 표시 (수정 모드에서는 표시하지 않음)
  const originalDataDisplay = !isEditMode && unmatchedItem ? [
    { label: '판매처', value: unmatchedItem.seller },
    { label: '상품번호', value: unmatchedItem.productNumber },
    { label: '상품명', value: unmatchedItem.productName },
    { label: '옵션명', value: unmatchedItem.optionName },
    { label: '수량', value: unmatchedItem.quantity },
  ] : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4">
          {isEditMode ? '매칭 규칙 수정' : '새 매칭 규칙 생성'}
        </h2>

        {originalDataDisplay.length > 0 && (
          <div className="mb-4 p-4 bg-gray-100 rounded border border-gray-300 max-h-40 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">원본 주문 정보</h3>
            {originalDataDisplay.map(item => (
              <p key={item.label} className="text-sm text-gray-600 mb-1">
                <span className="font-medium w-20 inline-block">{item.label}:</span> {item.value || '-'}
              </p>
            ))}
          </div>
        )}

        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="targetProductName" className="block text-sm font-medium text-gray-700">
              대상 상품명 (카테고리) <span className="text-red-500">*</span>
            </label>
            <button 
              onClick={() => setIsCategoryManagerOpen(true)}
              className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
              type="button"
            >
              <Settings className="w-3 h-3 mr-1" />
              카테고리 관리
            </button>
          </div>
          
          {!showCustomInput ? (
            <div className="mb-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white text-left flex justify-between items-center"
                >
                  <span className={selectedCategory ? 'text-gray-900' : 'text-gray-500'}>
                    {selectedCategory || '-- 카테고리 선택 --'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
                
                {isDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto focus:outline-none sm:text-sm border border-gray-200">
                    {categories.length === 0 ? (
                      <div className="text-gray-500 px-4 py-2 text-sm">
                        카테고리가 없습니다. 카테고리 관리에서 추가하세요.
                      </div>
                    ) : (
                      categories.map((category, index) => (
                        <div
                          key={index}
                          className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-blue-50 ${
                            selectedCategory === category ? 'bg-blue-100' : ''
                          }`}
                          onClick={() => handleCategorySelect(category)}
                        >
                          {category}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              
              <button
                onClick={() => setShowCustomInput(true)}
                className="mt-1 text-blue-600 hover:text-blue-800 text-sm flex items-center"
                type="button"
              >
                <PlusCircle className="w-3 h-3 mr-1" />
                직접 입력하기
              </button>
            </div>
          ) : (
            <div className="mb-2">
              <input
                type="text"
                id="customProductName"
                value={customProductName}
                onChange={(e) => setCustomProductName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="직접 상품명 입력"
              />
              <button
                onClick={() => setShowCustomInput(false)}
                className="mt-1 text-blue-600 hover:text-blue-800 text-sm"
                type="button"
              >
                카테고리에서 선택하기
              </button>
            </div>
          )}
          <p className="text-xs text-gray-500">이 규칙으로 매칭될 상품의 최종 이름을 선택하거나 입력하세요.</p>
        </div>

        <div className="mb-4">
          <label htmlFor="quantityWeight" className="block text-sm font-medium text-gray-700 mb-1">
            카테고리 기본 가중치
          </label>
          <input
            type="number"
            id="quantityWeight"
            value={quantityWeight}
            onChange={(e) => setQuantityWeight(parseInt(e.target.value) || 1)}```
            min="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
           <p className="text-xs text-gray-500 mt-1">이 카테고리의 기본 수량 가중치입니다. 개별 항목에 다른 가중치를 적용할 수 있습니다.</p>
        </div>

        <div className="mb-6">
          <label htmlFor="specificRuleWeight" className="block text-sm font-medium text-gray-700 mb-1">
            이 항목의 수량 가중치
          </label>
          <input
            type="number"
            id="specificRuleWeight"
            value={specificRuleWeight}
            onChange={(e) => setSpecificRuleWeight(parseInt(e.target.value) || 1)}
            min="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
           <p className="text-xs text-gray-500 mt-1">현재 항목에만 적용되는 가중치입니다. 엑셀의 '수량' 값에 이 가중치를 곱하여 최종 '판매 주문수량'을 계산합니다.</p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            type="button"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          >
            {isEditMode ? '규칙 수정' : '규칙 저장'}
          </button>
        </div>
      </div>
      
      {/* 카테고리 관리 모달 */}
      <CategoryManager 
        isOpen={isCategoryManagerOpen} 
        onClose={handleCategoryManagerClose} 
      />
    </div>
  );
}
