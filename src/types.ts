export interface ProcessedData {
  productName: string; // 내부 식별자 (예: '수집주문-상품A', '미매칭-판매처-상품번호-상품명-옵션명')
  printName: string; // 화면 표시용 이름 (예: '상품A', '판매처/상품명/옵션명')
  isMatched: boolean;
  salesAmount: number; // 집계용 데이터 (CSV에는 미포함)
  settlementAmount: number; // 집계용 데이터 (CSV에는 미포함)
  orderCount: number;
  quantity: number; // 최종 계산된 수량 (quantityWeight 적용 후)
  managementCode: string; // 필요 시 사용될 수 있는 관리 코드 (현재 미사용)
  purchaseAmount: number; // 집계용 데이터 (CSV에는 미포함)
  weight: number; // 집계용 데이터 (CSV에는 미포함)
  stockLocation: string; // 집계용 데이터 (CSV에는 미포함)
  boxSpec: string; // 집계용 데이터 (CSV에는 미포함)
  stock?: number;
  // 미매칭 항목의 원본 데이터를 저장하여 규칙 생성 시 사용
  originalOrder?: OrderData | null;
  // 매칭된 규칙의 식별자 (여러 규칙이 동일한 productName을 가질 수 있음)
  matchedRuleId?: string;
}

export interface MatchingRuleGroup {
  productName: string; // 사용자가 정의한 매칭될 상품명 (카테고리)
  stock: number;
  quantityWeight: number; // 사용자가 정의한 주문 건당 수량 가중치 (기본값 1)
  rules: string[]; // 원본 주문 정보 기반 규칙 식별자 문자열 배열 (예: ["판매처A|12345|상품A|옵션A", "판매처B|67890|상품B|"])
  // 각 규칙별 가중치 (규칙 식별자를 키로 사용)
  ruleWeights?: { [ruleId: string]: number };
  // 고유 식별자 (여러 규칙이 동일한 productName을 가질 수 있음)
  id?: string;
}

export interface OrderData {
  // --- Mandatory fields for matching ---
  seller: string; // 판매처
  productNumber: string; // 상품번호
  productName: string; // 상품명
  optionName: string; // 옵션명
  quantity: number; // 수량 (엑셀 원본)
  // --- Optional/Aggregated fields ---
  paymentAmount: number;
  settlementAmount: number;
  purchaseAmount: number;
  weight: number;
  stockLocation: string;
  boxSpec: string;
  // 원본 행 데이터를 저장하여 규칙 생성 시 활용 가능
  originalRowData?: any; // 필요 시 타입 구체화
  // 엑셀 형식 정보 추가
  excelFormat?: 'type1' | 'type2';
}
