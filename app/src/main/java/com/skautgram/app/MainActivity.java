package com.skautgram.app;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
public class MainActivity extends Activity {
 private WebView view;
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  view=new WebView(this);
  view.getSettings().setJavaScriptEnabled(true);
  view.getSettings().setDomStorageEnabled(true);
  view.setWebViewClient(new WebViewClient());
  setContentView(view);
  view.loadUrl("file:///android_asset/index.html");
 }
 @Override public void onBackPressed() {
  if(view!=null && view.canGoBack()) view.goBack(); else super.onBackPressed();
 }
}
