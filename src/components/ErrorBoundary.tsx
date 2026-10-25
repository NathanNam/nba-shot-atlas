import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Shows a plain message instead of a blank page. */
class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="max-w-xl mx-auto px-6 py-20 font-body">
        <h1 className="font-display text-3xl mb-3">Something went wrong.</h1>
        <p className="text-ink-2 mb-6">{this.state.error.message}</p>
        <button className="control" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    );
  }
}

export default ErrorBoundary;
