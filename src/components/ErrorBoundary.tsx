import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Logo } from './ui';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('AlphaArena render error', error, info);
  }

  private recover = () => {
    window.location.hash = '';
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAF9F6] px-5 text-[#141412]">
        <section className="w-full max-w-[560px] rounded-[28px] border border-[#D9D7CF] bg-white p-7 md:p-10">
          <Logo />
          <p className="micro-label mt-10 text-[#8A8A84]">Something interrupted this screen</p>
          <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.045em]">Your paper balance is safe.</h1>
          <p className="mt-4 text-[15px] leading-6 text-[#55554F]">
            AlphaArena couldn’t draw this screen correctly. Reload the app to continue; no real-money order can be created here.
          </p>
          <button onClick={this.recover} className="mt-7 min-h-11 rounded-full bg-[#141412] px-5 text-[14px] font-semibold text-white">
            Reload AlphaArena
          </button>
        </section>
      </main>
    );
  }
}
