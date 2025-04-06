import { MatchingRuleGroup } from '../types';

interface BackupData {
  version: 'v1';
  timestamp: string;
  rules: MatchingRuleGroup[];
  metadata: {
    totalRules: number;
    markets: string[];
    lastModified: string;
  };
}

export function downloadBackup(rules: MatchingRuleGroup[]) {
  const markets = new Set<string>();
  rules.forEach(rule => {
    rule.rules.forEach(ruleText => {
      const marketMatch = ruleText.match(/마켓이\s+([^\s]+)이고/);
      if (marketMatch) {
        markets.add(marketMatch[1]);
      }
    });
  });

  const backup: BackupData = {
    version: 'v1',
    timestamp: new Date().toISOString(),
    rules,
    metadata: {
      totalRules: rules.length,
      markets: Array.from(markets),
      lastModified: new Date().toISOString()
    }
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `matching-rules-backup-v1-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function loadBackup(file: File): Promise<MatchingRuleGroup[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target?.result as string) as BackupData;
        if (!backup.rules || !Array.isArray(backup.rules) || backup.version !== 'v1') {
          throw new Error('유효하지 않은 백업 파일입니다.');
        }
        resolve(backup.rules);
      } catch (error) {
        reject(new Error('백업 파일을 읽는데 실패했습니다.'));
      }
    };
    reader.onerror = () => reject(new Error('파일 읽기에 실패했습니다.'));
    reader.readAsText(file);
  });
}
