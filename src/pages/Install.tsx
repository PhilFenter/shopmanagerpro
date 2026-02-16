import { Smartphone, Tablet, Monitor, Share, MoreVertical, Plus, ArrowDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Install = () => {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Install Shop Manager Pro</h1>
        <p className="text-muted-foreground">
          Add the app to your device's home screen for quick access — works like a native app.
        </p>
      </div>

      <div className="space-y-6">
        {/* iPhone / iPad */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Smartphone className="h-5 w-5 text-primary" />
              <Tablet className="h-5 w-5 text-primary" />
              iPhone &amp; iPad (Safari)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm text-foreground">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                <span>Open this page in <strong>Safari</strong> (not Chrome or other browsers)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                <span>Tap the <strong>Share</strong> button <Share className="inline h-4 w-4" /> at the bottom of the screen</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                <span>Scroll down and tap <strong>"Add to Home Screen"</strong> <Plus className="inline h-4 w-4" /></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
                <span>Tap <strong>"Add"</strong> — the app icon will appear on your home screen</span>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Android */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Smartphone className="h-5 w-5 text-primary" />
              Android (Chrome)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm text-foreground">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                <span>Open this page in <strong>Chrome</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                <span>Tap the <strong>menu</strong> button <MoreVertical className="inline h-4 w-4" /> (three dots, top right)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                <span>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong> <ArrowDown className="inline h-4 w-4" /></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
                <span>Tap <strong>"Install"</strong> — the app will appear in your app drawer</span>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Desktop */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Monitor className="h-5 w-5 text-primary" />
              Desktop (Chrome / Edge)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm text-foreground">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                <span>Look for the <strong>install icon</strong> <ArrowDown className="inline h-4 w-4" /> in the browser address bar</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                <span>Click <strong>"Install"</strong> and the app opens in its own window</span>
              </li>
            </ol>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground pt-4">
          The app updates automatically — no app store needed. Works offline too.
        </p>
      </div>
    </div>
  );
};

export default Install;
