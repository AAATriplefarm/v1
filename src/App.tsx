import React, { useState, useCallback, useEffect } from 'react';
import { Upload, Download, PlusCircle, AlertTriangle, CheckCircle, FileType, Settings, Edit, Trash2, Info } from 'lucide-react';
import { processExcelFile } from './utils/excelProcessor';
import { ProcessedData, MatchingRuleGroup, OrderData } from './types';
import { defaultMatchingRules } from './utils/matchingRules';
import { downloadBackup, loadBackup } from './utils/backupManager';
import { RuleCreationModal } from './components/RuleCreationModal';
import { CategoryManager } from './components/CategoryManager';
import { DetailedMatchView } from './components/DetailedMatchView';

// 고유 ID 생성 함수
function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function App() {
  const [processedData, setProcessedData] = useState<ProcessedData[]>([]);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [matchingRules, setMatchingRules] = useState<MatchingRuleGroup[]>([]);
  const [selectedUnmatchedItem, setSelectedUnmatchedItem] = useState<OrderData | null>(null);
  const [selectedMatchedItem, setSelectedMatchedItem] = useState<ProcessedData | null>(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState<boolean>(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState<boolean>(false);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>(''); // 파일 이름 상태 추가
  const [detectedFormat, setDetectedFormat] = useState<string>(''); // 감지된 엑셀 형식
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [selectedRuleForEdit, setSelectedRuleForEdit] = useState<MatchingRuleGroup | undefined>(undefined);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState<boolean>(false);
  const [selectedRuleForDetail, setSelectedRuleForDetail] = useState<MatchingRuleGroup | null>(null);

  // Load rules from localStorage on initial mount
  useEffect(() => {
    try {
      const savedRules = localStorage.getItem('matchingRules');
      if (savedRules) {
        // Add basic validation
        const parsedRules = JSON.parse(savedRules);
        if (Array.isArray(parsedRules) && parsedRules.every(rule => typeof rule.productName === 'string' && Array.isArray(rule.rules))) {
          // 기존 규칙에 ID가 없으면 추가
          const rulesWithIds = parsedRules.map(rule => {
            if (!rule.id) {
              return { ...rule, id: generateUniqueId() };
            }
            return rule;
          });
          setMatchingRules(rulesWithIds);
        } else {
          console.warn("Invalid rules found in localStorage, using default.");
          setMatchingRules(defaultMatchingRules);
        }
      } else {
        setMatchingRules(defaultMatchingRules);
      }
    } catch (e) {
      console.error("Failed to load rules from localStorage:", e);
      setMatchingRules(defaultMatchingRules); // Fallback to default on error
    }
  }, []);

  // Save rules to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('matchingRules', JSON.stringify(matchingRules));
    } catch (e) {
      console.error("Failed to save rules to localStorage:", e);
      // Optionally notify the user
      setError("매칭 규칙을 로컬 저장소에 저장하는 데 실패했습니다. 브라우저 저장 공간이 부족할 수 있습니다.");
    }
  }, [matchingRules]);


  const runProcess = useCallback(async (file: File, rules: MatchingRuleGroup[]) => {
    setIsLoading(true);
    setError(''); // Clear previous errors
    try {
      const result = await processExcelFile(file, rules);
      setProcessedData(result);
      
      // 첫 번째 항목의 excelFormat을 확인하여 감지된 형식 표시
      if (result.length > 0 && result[0].originalOrder?.excelFormat) {
        const format = result[0].originalOrder.excelFormat;
        setDetectedFormat(format === 'type1' ? '수집된 주문' : '신규주문');
      } else {
        setDetectedFormat('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 처리 중 오류가 발생했습니다.');
      console.error(err);
      setProcessedData([]);
      setDetectedFormat('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setOriginalFile(file);
    setFileName(file.name); // 파일 이름 저장
    await runProcess(file, matchingRules);
    event.target.value = '';
  };

  const handleBackupUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError('');
    try {
      const loadedRules = await loadBackup(file);
      // 로드된 규칙에 ID가 없으면 추가
      const rulesWithIds = loadedRules.map(rule => {
        if (!rule.id) {
          return { ...rule, id: generateUniqueId() };
        }
        return rule;
      });
      setMatchingRules(rulesWithIds); // This will trigger the useEffect to save to localStorage
      // 백업 로드 후 원본 파일이 있으면 즉시 재처리
      if (originalFile) {
        await runProcess(originalFile, rulesWithIds);
      } else {
        setProcessedData([]); // 원본 파일 없으면 결과 초기화
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '백업 파일 로드 중 오류가 발생했습니다.');
      console.error(err);
      // Don't reset rules on backup load failure, keep existing ones
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  const handleUnmatchedClick = (item: ProcessedData) => {
    if (!item.isMatched && item.originalOrder) {
      setSelectedUnmatchedItem(item.originalOrder);
      setSelectedMatchedItem(null);
      setIsEditMode(false);
      setSelectedRuleForEdit(undefined);
      setIsRuleModalOpen(true);
    }
  };

  // 매칭된 항목 상세 보기
  const handleMatchedItemDetail = (item: ProcessedData) => {
    if (item.isMatched) {
      // 매칭된 규칙 찾기 (ID로 먼저 찾고, 없으면 productName으로 찾기)
      let matchedRule = item.matchedRuleId 
        ? matchingRules.find(rule => rule.id === item.matchedRuleId)
        : matchingRules.find(rule => rule.productName === item.printName);
      
      if (matchedRule) {
        setSelectedRuleForDetail(matchedRule);
        setIsDetailViewOpen(true);
      }
    }
  };

  // 매칭된 항목 수정 처리
  const handleMatchedItemEdit = (item: ProcessedData) => {
    if (item.isMatched) {
      // 매칭된 규칙 찾기 (ID로 먼저 찾고, 없으면 productName으로 찾기)
      let matchedRule = item.matchedRuleId 
        ? matchingRules.find(rule => rule.id === item.matchedRuleId)
        : matchingRules.find(rule => rule.productName === item.printName);
      
      if (matchedRule) {
        setSelectedMatchedItem(item);
        setSelectedUnmatchedItem(null);
        setIsEditMode(true);
        setSelectedRuleForEdit(matchedRule);
        setIsRuleModalOpen(true);
      }
    }
  };

  // 상세 보기에서 규칙 수정
  const handleEditRuleFromDetail = (rule: MatchingRuleGroup, ruleIndex: number) => {
    setSelectedRuleForEdit(rule);
    setIsEditMode(true);
    setIsDetailViewOpen(false);
    setIsRuleModalOpen(true);
  };

  // 상세 보기에서 규칙 삭제
  const handleDeleteRuleFromDetail = async (ruleIndex: number) => {
    const updatedRules = [...matchingRules];
    updatedRules.splice(ruleIndex, 1);
    setMatchingRules(updatedRules);
    setIsDetailViewOpen(false);
    
    // 원본 파일이 있으면 재처리
    if (originalFile) {
      await runProcess(originalFile, updatedRules);
    }
  };

  // 매칭된 항목 삭제 처리
  const handleMatchedItemDelete = async (item: ProcessedData) => {
    if (item.isMatched) {
      if (window.confirm(`"${item.printName}" 매칭 규칙을 삭제하시겠습니까?`)) {
        // 매칭된 규칙 찾기 (ID로 먼저 찾고, 없으면 productName으로 찾기)
        const updatedRules = item.matchedRuleId
          ? matchingRules.filter(rule => rule.id !== item.matchedRuleId)
          : matchingRules.filter(rule => rule.productName !== item.printName);
        
        setMatchingRules(updatedRules);
        
        // 원본 파일이 있으면 재처리
        if (originalFile) {
          await runProcess(originalFile, updatedRules);
        }
      }
    }
  };

  const handleRuleCreate = async (newRuleGroup: MatchingRuleGroup) => {
    let updatedRules;

    if (isEditMode && selectedRuleForEdit) {
      // 수정 모드: 기존 규칙 업데이트
      updatedRules = matchingRules.map(rule => 
        rule.id === selectedRuleForEdit.id ? newRuleGroup : rule
      );
    } else {
      // 신규 생성 모드
      // 동일한 카테고리(productName)를 가진 규칙이 있는지 확인
      const existingGroupIndex = matchingRules.findIndex(group => group.productName === newRuleGroup.productName);
      
      if (existingGroupIndex > -1) {
        updatedRules = [...matchingRules];
        const existingGroup = updatedRules[existingGroupIndex];
        const newIdentifier = newRuleGroup.rules[0];
        
        if (!existingGroup.rules.includes(newIdentifier)) {
          // 새 규칙 식별자 추가
          existingGroup.rules.push(newIdentifier);
          
          // 규칙별 가중치 업데이트
          if (!existingGroup.ruleWeights) {
            existingGroup.ruleWeights = {};
          }
          
          // 새 규칙의 가중치 설정
          if (newRuleGroup.ruleWeights && newRuleGroup.ruleWeights[newIdentifier]) {
            existingGroup.ruleWeights[newIdentifier] = newRuleGroup.ruleWeights[newIdentifier];
          } else {
            existingGroup.ruleWeights[newIdentifier] = newRuleGroup.quantityWeight;
          }
        } else {
          // 이미 존재하는 식별자라면 가중치만 업데이트
          if (!existingGroup.ruleWeights) {
            existingGroup.ruleWeights = {};
          }
          
          if (newRuleGroup.ruleWeights && newRuleGroup.ruleWeights[newIdentifier]) {
            existingGroup.ruleWeights[newIdentifier] = newRuleGroup.ruleWeights[newIdentifier];
          }
        }
      } else {
        // 완전히 새로운 규칙 그룹 추가
        updatedRules = [...matchingRules, newRuleGroup];
      }
    }

    setMatchingRules(updatedRules); // This triggers localStorage save via useEffect
    setIsRuleModalOpen(false);
    setSelectedUnmatchedItem(null);
    setSelectedMatchedItem(null);
    setIsEditMode(false);
    setSelectedRuleForEdit(undefined);

    if (originalFile) {
      await runProcess(originalFile, updatedRules);
    }
  };


  const downloadCSV = () => {
    if (processedData.length === 0) return;

    // CSV 헤더: '상품무게', '재고위치', '박스규격' 등 집계용 데이터 제거
    const headers = [
      '주문유형', '상품명', '매칭여부',
      '주문건수', '주문수량', '판매 주문수량' // '판매갯수'를 '판매 주문수량'으로 변경
    ];

    const csvContent = [
      headers.join(','),
      ...processedData.map(row => {
        // 매칭된 항목의 경우 원본 주문수량 계산
        const originalQuantity = row.isMatched ? 
          Math.round(row.quantity / (getMatchingWeight(row) || 1)) : 
          row.quantity;
          
        return [
          row.isMatched ? '매칭' : '미매칭', // 주문유형 단순화
          row.printName, // 화면 표시용 이름 사용
          row.isMatched ? '매칭' : '미매칭',
          row.orderCount,
          originalQuantity, // 원본 주문수량
          row.quantity // 가중치 적용된 판매 주문수량
        ].map(value => `"${String(value ?? '').replace(/"/g, '""')}"`) // null/undefined 처리 추가
         .join(',');
      }),
      // 합계 행
      [
        '"합계"', '""', '""',
        `"${processedData.reduce((sum, row) => sum + row.orderCount, 0)}"`,
        `"${processedData.reduce((sum, row) => {
          const weight = getMatchingWeight(row) || 1;
          return sum + Math.round(row.quantity / weight);
        }, 0)}"`,
        `"${processedData.reduce((sum, row) => sum + row.quantity, 0)}"`
      ].join(',')
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    // 파일 이름에 원본 엑셀 파일 이름 포함 (확장자 제외)
    const downloadFileNameBase = fileName ? fileName.substring(0, fileName.lastIndexOf('.')) || fileName : '처리결과';
    link.download = `${downloadFileNameBase}_매칭결과.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // 해당 항목에 대한 매칭 가중치 찾기 (ID 또는 productName으로 찾기)
  const getMatchingWeight = (item: ProcessedData): number | undefined => {
    if (!item.isMatched) return 1;
    
    // 매칭된 규칙 찾기
    const matchedRule = item.matchedRuleId 
      ? matchingRules.find(rule => rule.id === item.matchedRuleId)
      : matching```
Rules.find(rule => rule.productName === item.printName);
    
    if (!matchedRule) return 1;
    
    // 개별 규칙 가중치 확인
    if (item.originalOrder) {
      const ruleId = createOrderIdentifier(item.originalOrder);
      if (matchedRule.ruleWeights && matchedRule.ruleWeights[ruleId]) {
        return matchedRule.ruleWeights[ruleId];
      }
    }
    
    // 기본 가중치 반환
    return matchedRule.quantityWeight || 1;
  };

  // 주문 식별자 생성 함수 (excelProcessor와 동일하게 유지)
  function createOrderIdentifier(order: OrderData): string {
    const normalizeFieldValue = (value: string | undefined | null): string => {
      if (!value) return '';
      return value.trim().toLowerCase();
    };
    
    const normalizedSeller = normalizeFieldValue(order.seller);
    const normalizedProductNumber = normalizeFieldValue(order.productNumber);
    const normalizedProductName = normalizeFieldValue(order.productName);
    const normalizedOptionName = normalizeFieldValue(order.optionName);
    return `${normalizedSeller}|${normalizedProductNumber}|${normalizedProductName}|${normalizedOptionName}`;
  }

  // 원본 주문수량 계산 (가중치 적용 전)
  const getOriginalQuantity = (row: ProcessedData): number => {
    if (!row.isMatched) return row.quantity;
    
    const weight = getMatchingWeight(row) || 1;
    return Math.round(row.quantity / weight);
  };

  // 통계 정보 계산
  const totalItems = processedData.length;
  const matchedItems = processedData.filter(item => item.isMatched).length;
  const unmatchedItems = totalItems - matchedItems;
  const totalOrders = processedData.reduce((sum, item) => sum + item.orderCount, 0);
  const totalQuantity = processedData.reduce((sum, item) => sum + item.quantity, 0);
  const totalOriginalQuantity = processedData.reduce((sum, item) => sum + getOriginalQuantity(item), 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 text-center">
           <h1 className="text-3xl font-bold text-gray-800 mb-2">엑셀 매칭 및 집계 도구</h1>
           <p className="text-gray-600">엑셀 파일을 업로드하고 매칭 규칙을 관리하세요.</p>
        </header>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 items-start">
            {/* 파일 업로드 */}
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                1. 엑셀 파일 업로드
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-blue-300 border-dashed rounded-lg cursor-pointer bg-blue-50 hover:bg-blue-100 transition duration-150 ease-in-out">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                    <Upload className="w-10 h-10 mb-3 text-blue-500" />
                    <p className="mb-1 text-sm text-blue-700">
                      <span className="font-semibold">클릭 또는 드래그하여 파일 선택</span>
                    </p>
                    <p className="text-xs text-gray-500">.xlsx, .xls 파일 (필수 컬럼: 판매처, 상품번호, 상품명, 옵션명, 수량)</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
              <div className="mt-2 flex flex-col gap-1">
                {fileName && (
                  <p className="text-sm text-gray-600 truncate flex items-center">
                    <FileType className="w-4 h-4 mr-1" />
                    현재 파일: {fileName}
                  </p>
                )}
                {detectedFormat && (
                  <p className="text-sm text-blue-600 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    감지된 형식: {detectedFormat}
                  </p>
                )}
              </div>
            </div>

            {/* 규칙 관리 */}
            <div className="flex flex-col gap-3">
               <label className="block text-gray-700 text-sm font-bold mb-1">
                 2. 매칭 규칙 관리 (현재 {matchingRules.length}개)
               </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsCategoryManagerOpen(true)}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md flex items-center justify-center gap-2 transition duration-150 ease-in-out"
                >
                  <Settings className="w-4 h-4" />
                  카테고리 관리
                </button>
                <button
                  onClick={() => downloadBackup(matchingRules)}
                  disabled={matchingRules.length === 0}
                  className={`flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center justify-center gap-2 transition duration-150 ease-in-out ${matchingRules.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Download className="w-4 h-4" />
                  규칙 백업
                </button>
              </div>
              <label className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center justify-center gap-2 cursor-pointer transition duration-150 ease-in-out">
                <Upload className="w-4 h-4" />
                백업 불러오기 (.json)
                <input
                  type="file"
                  className="hidden"
                  accept=".json"
                  onChange={handleBackupUpload}
                />
              </label>
               <p className="text-xs text-gray-500 mt-1">
                 규칙은 브라우저에 자동 저장됩니다. 백업/복구를 통해 다른 환경에서도 사용할 수 있습니다.
               </p>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="ml-3 text-gray-600">파일을 처리 중입니다...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-4 flex items-center gap-2" role="alert">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <strong className="font-bold">오류 발생:</strong>
                <span className="block sm:inline ml-1">{error}</span>
              </div>
            </div>
          )}
        </div>

        {/* 결과표시 영역 */}
        {processedData.length > 0 && !isLoading && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
              <h2 className="text-xl font-semibold text-gray-800">처리 결과</h2>
              <button
                onClick={downloadCSV}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out flex items-center gap-2"
              >
                 <Download className="w-4 h-4" />
                결과 다운로드 (CSV)
              </button>
            </div>

            {/* 통계 정보 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-center">
              <div className="bg-gray-100 p-3 rounded-lg">
                <p className="text-sm text-gray-600">총 항목</p>
                <p className="text-lg font-bold text-gray-800">{totalItems}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <p className="text-sm text-green-700">매칭 성공</p>
                <p className="text-lg font-bold text-green-800">{matchedItems}</p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-lg">
                <p className="text-sm text-yellow-700">미매칭</p>
                <p className="text-lg font-bold text-yellow-800">{unmatchedItems}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <p className="text-sm text-blue-700">총 판매 주문수량</p>
                <p className="text-lg font-bold text-blue-800">{totalQuantity.toLocaleString()}</p>
              </div>
            </div>

            {unmatchedItems > 0 && (
               <p className="text-center text-yellow-700 mb-4 p-3 bg-yellow-50 rounded-md border border-yellow-200">
                 <PlusCircle className="inline w-4 h-4 mr-1" />
                 <span className="font-semibold">노란색 배경의 미매칭 항목</span>을 클릭하여 매칭 규칙을 생성할 수 있습니다.
               </p>
            )}
            {unmatchedItems === 0 && totalItems > 0 && (
              <p className="text-center text-green-600 mb-4 p-3 bg-green-50 rounded-md border border-green-200">
                <CheckCircle className="inline w-5 h-5 mr-1" />
                모든 항목이 성공적으로 매칭되었습니다!
              </p>
            )}

            <div className="overflow-x-auto shadow-md rounded-lg border border-gray-200">
              <table className="min-w-full bg-white text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">주문유형</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">상품명 (결과)</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">매칭상태</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 uppercase tracking-wider">주문건수</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 uppercase tracking-wider">주문수량</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 uppercase tracking-wider">판매 주문수량</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600 uppercase tracking-wider">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {processedData.map((row, index) => {
                    const weight = getMatchingWeight(row) || 1;
                    const originalQuantity = getOriginalQuantity(row);
                    
                    return (
                      <tr
                        key={index}
                        className={`hover:bg-gray-50 transition-colors duration-150 ${!row.isMatched ? 'bg-yellow-50 hover:bg-yellow-100 cursor-pointer' : ''}`}
                        onClick={!row.isMatched ? () => handleUnmatchedClick(row) : undefined}
                        title={!row.isMatched ? '클릭하여 매칭 규칙 생성' : ''}
                      >
                        <td className="px-4 py-2 whitespace-nowrap">
                           {row.isMatched ? (
                             <span className="text-green-700 font-medium">매칭</span>
                           ) : (
                             <span className="text-red-600 font-medium">미매칭</span>
                           )}
                        </td>
                        <td className="px-4 py-2">
                          {row.isMatched ? (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMatchedItemDetail(row);
                              }}
                              className="text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                              title="상세 정보 보기"
                            >
                              {row.printName}
                              <Info className="w-4 h-4 ml-1 inline-block" />
                            </button>
                          ) : (
                            row.printName
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {row.isMatched ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              매칭됨
                              {row.isMatched && (
                                <span className="ml-1">
                                  {(() => {
                                    // 매칭된 규칙 찾기
                                    const matchedRule = row.matchedRuleId 
                                      ? matchingRules.find(r => r.id === row.matchedRuleId)
                                      : matchingRules.find(r => r.productName === row.printName);
                                    
                                    return matchedRule ? `(${matchedRule.rules.length}종류)` : '';
                                  })()}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              미매칭
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{row.orderCount.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {originalQuantity.toLocaleString()}
                          {row.isMatched && weight > 1 && (
                            <span className="text-xs text-gray-500 ml-1">
                              (×{weight})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{row.quantity.toLocaleString()}</td>
                        <td className="px-4 py-2 text-center">
                          {row.isMatched && (
                            <div className="flex justify-center space-x-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleMatchedItemEdit(row)}
                                className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                                title="규칙 수정"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleMatchedItemDelete(row)}
                                className="p-1 text-red-600 hover:text-red-800 transition-colors"
                                title="규칙 삭제"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                 <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                   <tr className="font-bold text-gray-800">
                     <td className="px-4 py-3 text-left" colSpan={3}>합계</td>
                     <td className="px-4 py-3 text-right tabular-nums">
                       {totalOrders.toLocaleString()}
                     </td>
                     <td className="px-4 py-3 text-right tabular-nums">
                       {totalOriginalQuantity.toLocaleString()}
                     </td>
                     <td className="px-4 py-3 text-right tabular-nums">
                       {totalQuantity.toLocaleString()}
                     </td>
                     <td></td>
                   </tr>
                 </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 규칙 생성/수정 모달 */}
      <RuleCreationModal
        isOpen={isRuleModalOpen}
        onClose={() => {
          setIsRuleModalOpen(false);
          setSelectedUnmatchedItem(null);
          setSelectedMatchedItem(null);
          setIsEditMode(false);
          setSelectedRuleForEdit(undefined);
        }}
        onSave={handleRuleCreate}
        unmatchedItem={selectedUnmatchedItem}
        existingRule={selectedRuleForEdit}
        isEditMode={isEditMode}
      />

      {/* 카테고리 관리 모달 */}
      <CategoryManager
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
      />

      {/* 상세 정보 보기 모달 */}
      <DetailedMatchView
        isOpen={isDetailViewOpen}
        onClose={() => setIsDetailViewOpen(false)}
        matchingRule={selectedRuleForDetail}
        onEditRule={handleEditRuleFromDetail}
        onDeleteRule={handleDeleteRuleFromDetail}
        allRules={matchingRules}
      />
    </div>
  );
}

export default App;
