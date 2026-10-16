export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatNumber(num: number): string {
  return num.toLocaleString();
}

export function formatPercentage(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

export function formatPath(path: string, maxLength: number = 50): string {
  if (path.length <= maxLength) return path;
  
  const parts = path.split('/');
  if (parts.length <= 2) return path;
  
  const fileName = parts[parts.length - 1];
  const firstDir = parts[0];
  
  if (fileName.length + firstDir.length + 5 > maxLength) {
    return `${firstDir}/.../${fileName.slice(0, maxLength - firstDir.length - 8)}...`;
  }
  
  return `${firstDir}/.../${fileName}`;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return `${count} ${singular}`;
  return `${count} ${plural || singular + 's'}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function formatNodeLabel(label: string): string {
  // Remove file extension for cleaner display
  return label.replace(/\.(ts|tsx|js|jsx|css|scss|json)$/, '');
}

export function getRelativePath(from: string, to: string): string {
  const fromParts = from.split('/');
  const toParts = to.split('/');
  
  let commonLength = 0;
  const minLength = Math.min(fromParts.length, toParts.length);
  
  for (let i = 0; i < minLength; i++) {
    if (fromParts[i] === toParts[i]) {
      commonLength++;
    } else {
      break;
    }
  }
  
  const upLevels = fromParts.length - commonLength - 1;
  const relativeParts = toParts.slice(commonLength);
  
  if (upLevels === 0) {
    return './' + relativeParts.join('/');
  }
  
  return '../'.repeat(upLevels) + relativeParts.join('/');
}

export function sortByProperty<T>(
  array: T[],
  property: keyof T,
  ascending: boolean = true
): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[property];
    const bVal = b[property];
    
    if (aVal < bVal) return ascending ? -1 : 1;
    if (aVal > bVal) return ascending ? 1 : -1;
    return 0;
  });
}

export function groupBy<T>(
  array: T[],
  keyFn: (item: T) => string
): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}