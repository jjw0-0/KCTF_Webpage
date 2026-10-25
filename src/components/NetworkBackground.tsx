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
    if (document.cookie.includes('kctf_ipv4=')) return;

    let cancelled = false;
    const syncClientIp = () => {
      fetch('https://api4.ipify.org?format=json')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { ip?: string } | null) => {
          if (!cancelled && data?.ip) {
            return fetch('/api/client-ip', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ipv4: data.ip }),
            });
          }
          return null;
        })
        .catch(() => null);
    };

    const idleWindow = window as unknown as {
      requestIdleCallback?: typeof window.requestIdleCallback;
      cancelIdleCallback?: typeof window.cancelIdleCallback;
      setTimeout: typeof window.setTimeout;
      clearTimeout: typeof window.clearTimeout;
    };
    const idleId = idleWindow.requestIdleCallback
      ? idleWindow.requestIdleCallback(syncClientIp, { timeout: 3000 })
      : idleWindow.setTimeout(syncClientIp, 1500);

    return () => {
      cancelled = true;
      if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(idleId);
      else idleWindow.clearTimeout(idleId);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduceMotion = motionQuery.matches;

    // 캔버스 크기 설정
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();

    // 파티클 기본 설정
    const particleCount = () => window.innerWidth < 768 ? 30 : 55;
    const maxDistance = 222.5;        // 연결선이 그려지는 최대 거리 (px)
    const maxDistanceSquared = maxDistance * maxDistance;
    const mouseDistance = 150;        // 마우스 영향 반경 (px)
    const mouseDistanceSquared = mouseDistance * mouseDistance;

    const particleSprite = document.createElement('canvas');
    particleSprite.width = 32;
    particleSprite.height = 32;
    const spriteContext = particleSprite.getContext('2d');
    if (spriteContext) {
      const gradient = spriteContext.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255, 255, 255, .9)');
      gradient.addColorStop(.15, 'rgba(52, 178, 123, .95)');
      gradient.addColorStop(.5, 'rgba(52, 178, 123, .28)');
      gradient.addColorStop(1, 'rgba(52, 178, 123, 0)');
      spriteContext.fillStyle = gradient;
      spriteContext.fillRect(0, 0, 32, 32);
    }

    // 파티클 초기화 함수
    const initParticles = () => {
      particlesRef.current = [];
      for (let i = 0; i < particleCount(); i++) {
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
      const lineBuckets: number[][] = [[], [], [], []];
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distanceSquared = dx * dx + dy * dy;

          // maxDistance 이내의 파티클만 연결선 그리기
          if (distanceSquared < maxDistanceSquared) {
            const distance = Math.sqrt(distanceSquared);
            // 거리에 따라 투명도 계산 (가까울수록 진하게)
            // Math.pow: 부드러운 감소 곡선
            // 마지막 곱하는 값(현재 1.0): 전체 선 밝기 조절
            const opacity = Math.pow(1 - distance / maxDistance, 2) * 1.0;
            const bucket = Math.min(lineBuckets.length - 1, Math.floor(opacity * lineBuckets.length));
            lineBuckets[bucket].push(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
          }
        }
      }
      ctx.lineWidth = 0.725;
      lineBuckets.forEach((segments, bucket) => {
        if (!segments.length) return;
        ctx.beginPath();
        for (let i = 0; i < segments.length; i += 4) {
          ctx.moveTo(segments[i], segments[i + 1]);
          ctx.lineTo(segments[i + 2], segments[i + 3]);
        }
        ctx.strokeStyle = `rgba(52, 178, 123, ${(bucket + .5) / lineBuckets.length})`;
        ctx.stroke();
      });

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
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared < mouseDistanceSquared && distanceSquared > 0) {
          const dist = Math.sqrt(distanceSquared);
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

        // 재사용 가능한 스프라이트로 매 프레임 gradient를 다시 만들지 않는다.
        const glowIntensity = 0.7 + pulseValue * 0.2;
        const glowRadius = particle.radius * (4 + pulseValue * 0.8);
        ctx.globalAlpha = glowIntensity;
        ctx.drawImage(particleSprite, particle.x - glowRadius, particle.y - glowRadius, glowRadius * 2, glowRadius * 2);
      });
      ctx.globalAlpha = 1;

      // 모션 감소 상태에서는 현재 장면을 한 번만 그려 정지 배경으로 유지한다.
      animationFrameRef.current = reduceMotion ? null : requestAnimationFrame(animate);
    };

    animate();

    const handleMotionPreference = (event: MediaQueryListEvent) => {
      reduceMotion = event.matches;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      animate();
    };

    // 윈도우 리사이즈 핸들러
    const handleResize = () => {
      resizeCanvas();
      initParticles();
      if (reduceMotion) animate();
    };

    const handleVisibility = () => {
      if (document.hidden) {
        if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      } else if (!reduceMotion && animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibility);
    motionQuery.addEventListener('change', handleMotionPreference);

    // 클린업 (메모리 누수 방지)
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibility);
      motionQuery.removeEventListener('change', handleMotionPreference);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="network-canvas fixed inset-0"
      style={{ pointerEvents: 'none', zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
