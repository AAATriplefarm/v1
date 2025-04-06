import React, { useState, useEffect } from 'react';
import { X, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { MatchingRuleGroup, OrderData } from '../types';

interface DetailedMatchViewProps {
  isOpen: boolean;
  onClose: () => void;
  matchingRule: MatchingRuleGroup | null;
  onEditRule: (rule: MatchingRuleGroup, ruleIndex: number) => void;
  onDeleteRule: (ruleIndex: number) => void;
  allRules: MatchingRuleGroup[];
}

// 규칙 식별자에서 원본 주문 정보 추출
function parseRuleIdentifier(identifier: string): OrderData {
  const [seller, productNumber, productName, optionName] = identifier.split('|');
  return {
    seller: seller || '',
    productNumber: productNumber || '',
    productName: productName || '',
    optionName: optionName || '',
    quantity: 0, // 기본값
    paymentAmount: 0,
    settlementAmount: 0,
    purchaseAmount: 0,
    weight: 0,
    stockLocation: '',
    boxSpec: ''
  };
}

export function DetailedMatchView({ 
  isOpen, 
  onClose, 
  matchingRule, 
  onEditRule, 
  onDeleteRule,
  allRules
}: DetailedMatchViewProps) {
  const [expandedRules, setExpandedRules] = useState<OrderData[]>([]);
  
  useEffect(() => {
    if (isOpen && matchingRule) {
      // 규칙 식별자를 파싱하여 원본 주문 정보로 변환
      const parsedRules = matchingRule.rules.map(rule => parseRuleIdentifier(rule));
      setExpandedRules(parsedRules);
    } else {
      setExpandedRules([]);
    }
  }, [isOpen, matchingRule]);

  if (!isOpen || !matchingRule) return null;

  // 현재 규칙의 인덱스 찾기
  const currentRuleIndex = allRules.findIndex(rule => rule.id === matchingRule.id || rule.productName === matchingRule.productName);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <button 
              onClick={onClose}
              className="mr-2 text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold">
              "{matchingRule.productName}" 매칭 상세정보
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 bg-blue-50 p-3 rounded-md border border-blue-200">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-blue-800">
                <span className="font-semibold">총 매칭 항목:</span> {matchingRule.rules.length}개
              </p>
              <p className="text-sm text-blue-800">
                <span className="font-semibold">카테고리 기본 가중치:</span> {matchingRule.quantityWeight || 1}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onEditRule(matchingRule, currentRuleIndex)}
                className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 flex items-center gap-1 text-sm"
              >
                <Edit className="w-4 h-4" />
                전체 수정
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`"${matchingRule.productName}" 매칭 규칙을 삭제하시겠습니까?`)) {
                    onDeleteRule(currentRuleIndex);
                  }
                }}
                className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 flex items-center gap-1 text-sm"
              >
                <Trash2 className="w-4 h-4" />
                전체 삭제
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="min-w-full bg-white text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">판매처</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">상품번호</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">상품명</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">옵션명</th>
                <th className="px-4 py-2 text-center font-semibold text-gray-600">가중치</th>
                <th className="px-4 py-2 text-center font-semibold text-gray-600">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {expandedRules.map((rule, index) => {
                const ruleId = matchingRule.rules[index];
                const weight = matchingRule.ruleWeights && matchingRule.ruleWeights[ruleId] 
                  ? matchingRule.ruleWeights[ruleId] 
                  : matchingRule.quantityWeight || 1;
                
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap">{rule.seller || '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{rule.productNumber || '-'}</td>
                    <td className="px-4 py-2">{rule.productName || '-'}</td>
                    <td className="px-4 py-2">{rule.optionName || '-'}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={weight !== (matchingRule.quantityWeight || 1) ? "font-bold text-blue-600" : ""}>
                        {weight}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => {
                            // 개별 항목 수정 로직
                            // 해당 항목의 OrderData 객체 생성
                            const orderData: OrderData = {
                              seller: rule.seller,
                              productNumber: rule.productNumber,
                              productName: rule.productName,
                              optionName: rule.optionName,
                              quantity: 0,
                              paymentAmount: 0,
                              settlementAmount: 0,
                              purchaseAmount: 0,
                              weight: 0,
                              stockLocation: '',
                              boxSpec: ''
                            };
                            
                            // 수정 모드로 전환하고 해당 항목 정보 전달
                            const ruleForEdit = { ...matchingRule };
                            onEditRule(ruleForEdit, currentRuleIndex);
                          }}
                          className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                          title="항목 수정"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('이 매칭 항목을 삭제하시겠습니까?')) {
                              // 개별 규칙 삭제 로직
                              const updatedRule = { ...matchingRule };
                              updatedRule.rules = updatedRule.rules.filter((_, i) => i !== index);
                              
                              // 규칙별 가중치도 함께 업데이트
                              if (updatedRule.ruleWeights) {
                                const ruleId = matchingRule.rules[index];
                                const newRuleWeights = { ...updatedRule.ruleWeights };
                                delete newRuleWeights[ruleId];
                                updatedRule.ruleWeights = newRuleWeights;
                              }
                              
                              // 규칙이 하나도 남지 않으면 전체 규칙 삭제
                              if (updatedRule.rules.length === 0) {
                                onDeleteRule(currentRuleIndex);
                              } else {
                                // 아니면 업데이트된 규칙으로 교체
                                onEditRule(updatedRule, currentRuleIndex);
                              }
                            }
                          }}
                          className="p-1 text-red-600 hover:text-red-800 transition-colors"
                          title="항목 삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
