import * as XLSX from 'xlsx';
import { ProcessedData, MatchingRuleGroup, OrderData } from '../types';

// 필드 정규화 함수 (공백 제거, 소문자 변환 등)
function normalizeFieldValue(value: string | undefined | null): string {
    if (!value) return '';
    // 필요에 따라 추가 정규화 규칙 적용 가능
    return value.trim().toLowerCase();
}

// 주문 식별자 생성 함수 (판매처|상품번호|상품명|옵션명)
function createOrderIdentifier(order: OrderData): string {
  const normalizedSeller = normalizeFieldValue(order.seller);
  const normalizedProductNumber = normalizeFieldValue(order.productNumber);
  const normalizedProductName = normalizeFieldValue(order.productName);
  const normalizedOptionName = normalizeFieldValue(order.optionName);
  // 수량은 식별자에 포함하지 않음
  return `${normalizedSeller}|${normalizedProductNumber}|${normalizedProductName}|${normalizedOptionName}`;
}

export async function processExcelFile(file: File, ruleGroups: MatchingRuleGroup[]): Promise<ProcessedData[]> {
  const data = await readExcelFile(file);
  return processOrders(data, ruleGroups);
}

// 엑셀 파일 형식 감지 함수
function detectExcelFormat(headers: string[]): 'type1' | 'type2' {
  // 첫 번째 컬럼이 'No.'인 경우 Type 1 (수집된 주문), 'CS상태'인 경우 Type 2 (신규주문)
  if (headers.length > 0) {
    if (headers[0].trim() === 'No.') {
      return 'type1'; // 수집된 주문
    } else if (headers[0].trim() === 'CS상태') {
      return 'type2'; // 신규주문
    }
  }
  
  // 기본값은 Type 2 (신규주문)
  return 'type2';
}

async function readExcelFile(file: File): Promise<OrderData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });

        if (jsonData.length < 2) {
          resolve([]);
          return;
        }

        const headers: string[] = (jsonData[0] as string[]).map(h => h.trim());
        const dataRows = jsonData.slice(1);
        
        // 엑셀 형식 감지
        const excelFormat = detectExcelFormat(headers);
        console.log(`Detected Excel format: ${excelFormat}`);

        const headerMap: { [key: string]: number } = {};
        headers.forEach((header, index) => {
          if (header) {
            headerMap[header] = index;
          }
        });

        // 필수 헤더 5개 확인
        const requiredHeaders = ['판매처', '상품번호', '상품명', '옵션명', '수량'];
        const missingHeaders = requiredHeaders.filter(h => headerMap[h] === undefined);
        if (missingHeaders.length > 0) {
          throw new Error(`필수 컬럼이 누락되었습니다: ${missingHeaders.join(', ')}`);
        }

        // 유효한 데이터 행만 필터링 (빈 행 제거)
        const validDataRows = dataRows.filter((row: any[]) => {
          // 최소한 하나의 필수 필드에 값이 있는지 확인
          return requiredHeaders.some(header => {
            const colIndex = headerMap[header];
            return colIndex !== undefined && row[colIndex] && String(row[colIndex]).trim() !== '';
          });
        });

        const orders = validDataRows.map((row: any[]) => {
          // 필수 데이터 추출
          const seller = String(row[headerMap['판매처']] || '');
          const productNumber = String(row[headerMap['상품번호']] || '');
          const productName = String(row[headerMap['상품명']] || '');
          const optionName = String(row[headerMap['옵션명']] || '');
          const quantity = parseInt(String(row[headerMap['수량']] || '0')) || 0;

          // 선택적 데이터 추출 (기존 로직 유지, 없으면 기본값)
          const paymentAmount = parseInt(String(row[headerMap['결제금액']] || '0').replace(/[^\d-]/g, '')) || 0;
          const settlementAmount = parseInt(String(row[headerMap['정산예정금액']] || '0').replace(/[^\d-]/g, '')) || 0;
          const purchaseAmount = parseInt(String(row[headerMap['사입금액']] || '0').replace(/[^\d-]/g, '')) || 0;
          const weight = parseFloat(String(row[headerMap['상품무게']] || '0').replace(/[^\d.]/g, '')) || 0;
          const stockLocation = String(row[headerMap['재고위치']] || '');
          const boxSpec = String(row[headerMap['박스규격']] || '');

          return {
            seller,
            productNumber,
            productName,
            optionName,
            quantity,
            paymentAmount,
            settlementAmount,
            purchaseAmount,
            weight,
            stockLocation,
            boxSpec,
            originalRowData: row,
            excelFormat // 엑셀 형식 정보 추가
          };
        }).filter(order => order.seller || order.productNumber || order.productName || order.optionName); // 필수 필드 중 하나라도 있어야 유효한 주문으로 간주

        resolve(orders);
      } catch (error) {
        console.error('Excel parsing error:', error);
        reject(new Error(`엑셀 파일 처리 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`));
      }
    };
    reader.onerror = () => reject(new Error('파일 읽기에 실패했습니다.'));
    reader.readAsArrayBuffer(file);
  });
}

// 주문 데이터와 규칙 비교하여 매칭되는 규칙 찾기
function findMatchingRule(order: OrderData, ruleGroups: MatchingRuleGroup[]): { rule: MatchingRuleGroup, ruleId: string } | null {
  const orderIdentifier = createOrderIdentifier(order); // 정규화된 식별자 사용

  for (const group of ruleGroups) {
    // 규칙 식별자도 정규화된 상태로 저장되어 있다고 가정
    if (group.rules.includes(orderIdentifier)) {
      return { 
        rule: group, 
        ruleId: orderIdentifier 
      };
    }
  }
  return null; // 매칭되는 규칙 없음
}

// 주문 처리 및 집계
function processOrders(orders: OrderData[], ruleGroups: MatchingRuleGroup[]): ProcessedData[] {
  const processedData: { [key: string]: ProcessedData } = {};

  orders.forEach(order => {
    const matchResult = findMatchingRule(order, ruleGroups);

    if (matchResult) {
      const { rule, ruleId } = matchResult;
      const key = rule.productName; // 매칭된 그룹의 상품명 사용
      
      // 해당 규칙의 가중치 결정 (개별 규칙 가중치 또는 그룹 기본 가중치)
      const weight = rule.ruleWeights && rule.ruleWeights[ruleId] 
        ? rule.ruleWeights[ruleId] 
        : rule.quantityWeight || 1;
      
      if (!processedData[key]) {
        processedData[key] = {
          productName: `수집주문-${key}`, // 내부 식별자
          printName: key, // 화면 표시용 이름
          isMatched: true,
          salesAmount: 0, settlementAmount: 0, orderCount: 0, quantity: 0,
          managementCode: '', purchaseAmount: 0, weight: 0,
          stockLocation: '', boxSpec: '', stock: rule.stock,
          originalOrder: null,
          matchedRuleId: rule.id // 매칭된 규칙 그룹의 ID 저장
        };
      }

      const calculatedQuantity = order.quantity * weight;

      processedData[key].quantity += calculatedQuantity;
      processedData[key].salesAmount += order.paymentAmount;
      processedData[key].settlementAmount += order.settlementAmount;
      processedData[key].orderCount += 1;
      processedData[key].purchaseAmount += order.purchaseAmount;
      processedData[key].weight += order.weight * order.quantity; // 무게는 개별 수량 곱해서 합산
      if (!processedData[key].stockLocation && order.stockLocation) processedData[key].stockLocation = order.stockLocation;
      if (!processedData[key].boxSpec && order.boxSpec) processedData[key].boxSpec = order.boxSpec;

    } else {
      // 미매칭 주문 처리
      const orderIdentifier = createOrderIdentifier(order); // 미매칭 키 생성용
      const key = `미매칭-${orderIdentifier}`;
      // 미매칭 표시 이름: 판매처 / 상품명 / 옵션명 (간결하게)
      const printName = [order.seller, order.productName, order.optionName].filter(Boolean).join(' / ');

      if (!processedData[key]) {
        processedData[key] = {
          productName: key,
          printName: printName || '정보부족', // 표시할 이름이 없으면 대체 텍스트
          isMatched: false,
          salesAmount: 0, settlementAmount: 0, orderCount: 0, quantity: 0,
          managementCode: '', purchaseAmount: 0, weight: 0,
          stockLocation: order.stockLocation, boxSpec: order.boxSpec, stock: undefined,
          originalOrder: order // 원본 주문 데이터 저장
        };
      }
      // 미매칭 항목은 원본 수량 합산
      processedData[key].quantity += order.quantity;
      processedData[key].salesAmount += order.paymentAmount;
      processedData[key].settlementAmount += order.settlementAmount;
      processedData[key].orderCount += 1;
      processedData[key].purchaseAmount += order.purchaseAmount;
      processedData[key].weight += order.weight * order.quantity; // 무게는 개별 수량 곱해서 합산
    }
  });

  // 결과 정렬 (매칭 -> 미매칭 순, 그 안에서는 printName으로 정렬)
  return Object.values(processedData).sort((a, b) => {
    if (a.isMatched && !b.isMatched) return -1;
    if (!a.isMatched && b.isMatched) return 1;
    return a.printName.localeCompare(b.printName);
  });
}
