import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import i18n from "../../lib/i18n";
import { Layout } from "../layout";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("PageErrorBoundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const t = i18n.t.bind(i18n);

      return (
        <Layout>
          <div className="flex items-center justify-center px-4 py-16">
            <div className="text-center max-w-sm">
              <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-red-300" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                {t("errorPages.error.title")}
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                {t("errorPages.error.description")}
              </p>
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <RotateCcw className="w-4 h-4" />
                {t("errorPages.reload")}
              </button>
              {import.meta.env.DEV && this.state.error && (
                <details className="mt-6 text-left">
                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300">
                    {t("errorPages.dev.details")}
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs text-red-600 dark:text-red-400 overflow-auto max-h-40">
                    {this.state.error.message}
                    {"\n"}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </Layout>
      );
    }

    return this.props.children;
  }
}
