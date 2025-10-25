/**
 * 네트워크 파티클 백그라운드 컴포넌트
 * Canvas 2D API를 사용하여 부드러운 파티클 네트워크 애니메이션 구현
 */
'use client';

import { useEffect, useRef } from 'react';

// 파티클 데이터 구조
interface Particle {
  x: number;          // X 좌표
  y: number;          // Y 좌표
  vx: number;         // X 방향 속도 (현재)
  vy: number;         // Y 방향 속도 (현재)
  radius: number;     // 파티클 반지름
  baseVx: number;     // X 방향 기본 속도 (복귀 기준)
  baseVy: number;     // Y 방향 기본 속도 (복귀 기준)
  pulse: number;      // 펄스 애니메이션 각도 (0 ~ 2π)
  pulseSpeed: number; // 펄스 변화 속도 (빛나는 속도)
}

export default function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 캔버스 크기 설정
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();

    // 파티클 기본 설정
    const particleCount = 50;        // 파티클 개수
    const maxDistance = 200;          // 연결선이 그려지는 최대 거리 (px)
    const mouseDistance = 150;        // 마우스 영향 반경 (px)

    // 파티클 초기화 함수
    const initParticles = () => {
      particlesRef.current = [];
      for (let i = 0; i < particleCount; i++) {
        // 기본 속도 계산
        const baseVx = (Math.random() - 0.5) * 0.75;
        const baseVy = (Math.random() - 0.5) * 0.75;

        particlesRef.current.push({
          x: Math.random() * canvas.width,             // 랜덤 X 위치
          y: Math.random() * canvas.height,            // 랜덤 Y 위치
          vx: baseVx,                                   // 초기 X 속도
          vy: baseVy,                                   // 초기 Y 속도
          baseVx,                                       // 기준 X 속도 (복귀용)
          baseVy,                                       // 기준 Y 속도 (복귀용)
          radius: Math.random() * 1 + 0.5,              // 크기 (0.5 ~ 1.5)
          pulse: Math.random() * Math.PI * 2,          // 펄스 시작 각도 (랜덤)
          pulseSpeed: 0.02 + Math.random() * 0.02,     // 펄스 속도 (0.02 ~ 0.04)
        });
      }
    };

    initParticles();

    // 마우스 이벤트 핸들러
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseLeave = () => {
      // 화면 밖으로 마우스가 나가면 영향 제거
      mouseRef.current = { x: -1000, y: -1000 };
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    // 애니메이션 루프
    const animate = () => {
      if (!ctx || !canvas) return;

      // 캔버스 초기화 (이전 프레임 지우기)
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;

      // 연결선 그리기
      ctx.lineWidth = 0.5;  // 연결선 두께 (px)
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // maxDistance 이내의 파티클만 연결선 그리기
          if (distance < maxDistance) {
            // 거리에 따라 투명도 계산 (가까울수록 진하게)
            // Math.pow: 부드러운 감소 곡선
            // 마지막 곱하는 값(현재 1.0): 전체 선 밝기 조절
            const opacity = Math.pow(1 - distance / maxDistance, 2) * 1.0;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(52, 178, 123, ${opacity})`;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // 파티클 업데이트 및 그리기
      particles.forEach((particle) => {
        // 펄스 업데이트
        particle.pulse += particle.pulseSpeed;
        const pulseValue = Math.sin(particle.pulse) * 0.5 + 0.5; // 0~1 사이 값

        // 무작위 움직임
        particle.vx += (Math.random() - 0.5) * 0.01;
        particle.vy += (Math.random() - 0.5) * 0.01;

        // 위치 업데이트
        particle.x += particle.vx;
        particle.y += particle.vy;

        // 경계 체크 및 반사
        if (particle.x < 0 || particle.x > canvas.width) {
          particle.vx *= -1;        // 속도 반전
          particle.baseVx *= -1;    // 기본 속도도 반전
          particle.x = Math.max(0, Math.min(canvas.width, particle.x));
        }
        if (particle.y < 0 || particle.y > canvas.height) {
          particle.vy *= -1;
          particle.baseVy *= -1;
          particle.y = Math.max(0, Math.min(canvas.height, particle.y));
        }

        // 마우스 인터랙션
        const dx = mouseRef.current.x - particle.x;
        const dy = mouseRef.current.y - particle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouseDistance && dist > 0) {
          const force = (mouseDistance - dist) / mouseDistance;  // 거리에 따른 힘
          const angle = Math.atan2(dy, dx);
          // 마지막 곱하는 값: 마우스 영향력 조절
          particle.vx -= Math.cos(angle) * force * 0.3;
          particle.vy -= Math.sin(angle) * force * 0.3;
        }

        // 기본 속도로 복귀
        // 마지막 곱하는 값(0.01): 복귀 속도 조절
        particle.vx += (particle.baseVx - particle.vx) * 0.01;
        particle.vy += (particle.baseVy - particle.vy) * 0.01;

        // 감쇠
        particle.vx *= 0.99;
        particle.vy *= 0.99;

        // 최대 속도 제한
        const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
        if (speed > 1.5) {
          particle.vx = (particle.vx / speed) * 1.5;
          particle.vy = (particle.vy / speed) * 1.5;
        }

        // 글로우 효과 설정
        // glowIntensity: 기본 밝기(0.7) + 펄스 변화량(0.2)
        const glowIntensity = 0.7 + pulseValue * 0.2;
        // glowRadius: 글로우가 퍼지는 반경 (숫자가 클수록 넓게 퍼짐)
        const glowRadius = particle.radius * (4 + pulseValue * 0.8);

        // 외부 글로우 (넓게 퍼지는 빛)
        const outerGradient = ctx.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          glowRadius
        );
        // 각 색상 정지점의 투명도 조절 (0.0 ~ 1.0)
        outerGradient.addColorStop(0, `rgba(52, 178, 123, ${glowIntensity * 0.7})`);    // 중심 (0.8)
        outerGradient.addColorStop(0.3, `rgba(52, 178, 123, ${glowIntensity * 0.4})`);  // 중간 (0.4)
        outerGradient.addColorStop(0.6, `rgba(52, 178, 123, ${glowIntensity * 0.3})`);  // 외곽 (0.2)
        outerGradient.addColorStop(1, 'rgba(52, 178, 123, 0)');                          // 완전 투명

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = outerGradient;
        ctx.fill();

        // 내부 글로우 (파티클 중심 빛)
        const innerGradient = ctx.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          particle.radius * 2
        );
        // 중심은 흰색, 중간부터 녹색으로 변화
        innerGradient.addColorStop(0, `rgba(255, 255, 255, ${glowIntensity * 0.5})`);   // 중심 흰색
        innerGradient.addColorStop(0.5, `rgba(52, 178, 123, ${glowIntensity * 1})`);  // 중간 녹색
        innerGradient.addColorStop(1, `rgba(52, 178, 123, ${glowIntensity * 1})`);    // 외곽 녹색

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = innerGradient;
        ctx.fill();

        // 밝은 중심점
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        // 흰색 중심점 투명도: 기본 + 펄스 변화
        ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + pulseValue * 0.2})`;
        ctx.fill();
      });

      // 다음 프레임 요청
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    // 윈도우 리사이즈 핸들러
    const handleResize = () => {
      resizeCanvas();
      initParticles();
    };

    window.addEventListener('resize', handleResize);

    // 클린업 (메모리 누수 방지)
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0"
      style={{ pointerEvents: 'none', zIndex: 0 }}
    />
  );
}
