import React, { Component, ErrorInfo, ReactNode } from 'react';
import ErrorFallback from './ErrorFallback';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * GlobalErrorBoundary Component
 * 
 * A global error boundary component that catches JavaScript errors in its child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 */
class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to the console
    console.error('Global error caught by GlobalErrorBoundary:', error);
    console.error('Component stack:', errorInfo.componentStack);
    
    // Update state with error info
    this.setState({
      errorInfo
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <ErrorFallback 
          error={this.state.error || undefined}
          message="Er is een onverwachte fout opgetreden in de applicatie. Dit kan worden veroorzaakt door een probleem met de API-server of een andere component."
        />
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
