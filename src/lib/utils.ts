/**
 * 유틸리티 함수 모음
 */
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind CSS 클래스를 조건부로 병합하고 충돌을 해결합니다.
 * @param inputs - 클래스 이름, 조건부 클래스, 객체 형태의 클래스
 * @returns 병합된 클래스 문자열
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
