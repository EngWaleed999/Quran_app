import { Reciter } from '../types/audio.types';

/**
 * Al Quran Cloud publishes these edition identifiers and their available
 * bitrates in its public audio-CDN catalog. Keep identifiers separate from
 * display names; the edition value is used in the remote URL.
 */
export const RECITERS: Reciter[] = [
  {
    id: 'ar.alafasy',
    name: 'مشاري راشد العفاسي',
    subname: 'حفص عن عاصم • مرتل',
    edition: 'ar.alafasy',
    bitrate: 128,
  },
  {
    id: 'ar.husary',
    name: 'محمود خليل الحصري',
    subname: 'حفص عن عاصم • مرتل',
    edition: 'ar.husary',
    bitrate: 128,
  },
  {
    id: 'ar.minshawi',
    name: 'محمد صديق المنشاوي',
    subname: 'حفص عن عاصم • مرتل',
    edition: 'ar.minshawi',
    bitrate: 128,
  },
  {
    id: 'ar.abdulbasit',
    name: 'عبد الباسط عبد الصمد',
    subname: 'حفص عن عاصم • مرتل',
    edition: 'ar.abdulbasit',
    bitrate: 192,
  },
  {
    id: 'ar.hudhaify',
    name: 'علي بن عبد الرحمن الحذيفي',
    subname: 'حفص عن عاصم • مرتل',
    edition: 'ar.hudhaify',
    bitrate: 128,
  },
  {
    id: 'ar.shuraim',
    name: 'سعود الشريم',
    subname: 'حفص عن عاصم • مرتل',
    edition: 'ar.shuraim',
    bitrate: 128,
  },
];
