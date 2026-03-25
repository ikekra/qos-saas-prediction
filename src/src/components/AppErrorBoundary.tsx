import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || "Unexpected UI error" };
  }

  componentDidCatch(error: Error) {
    console.error("AppErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-6">
          <div className="max-w-lg rounded-xl border p-6 bg-card">
            <h1 className="text-2xl font-semibold mb-2">UI failed to render</h1>
            <p className="text-sm text-muted-foreground mb-4">
              {this.state.message}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()}>Reload</Button>
              <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
                Go Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

