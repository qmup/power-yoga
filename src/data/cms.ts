import rawData from './cms-data.json';
import type { CmsData, WeekDayColumn } from './types';

export const CMS: CmsData = rawData as CmsData;

export const SITE = CMS.site;

export const WEEK_DAYS: WeekDayColumn[] = [
  { key: 'mon', shortLabel: 'T.Hai', fullLabel: 'Thứ 2' },
  { key: 'tue', shortLabel: 'T.Ba', fullLabel: 'Thứ 3' },
  { key: 'wed', shortLabel: 'T.Tư', fullLabel: 'Thứ 4' },
  { key: 'thu', shortLabel: 'T.Năm', fullLabel: 'Thứ 5' },
  { key: 'fri', shortLabel: 'T.Sáu', fullLabel: 'Thứ 6' },
  { key: 'sat', shortLabel: 'T.Bảy', fullLabel: 'Thứ 7' },
  { key: 'sun', shortLabel: 'C.Nhật', fullLabel: 'Chủ Nhật' },
];
