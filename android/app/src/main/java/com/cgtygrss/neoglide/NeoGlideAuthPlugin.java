package com.cgtygrss.neoglide;

import android.content.SharedPreferences;
import android.os.CancellationSignal;
import androidx.credentials.CredentialManager;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.exceptions.GetCredentialException;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;
import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.AuthCredential;
import com.google.firebase.auth.GoogleAuthProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.Executor;

@CapacitorPlugin(name="NeoGlideAuth")
public class NeoGlideAuthPlugin extends Plugin {
 private AuthCredential candidate;
 private boolean playGamesEnabled;
 private boolean gamesInitialized;
 private FirebaseAuth current() {
  if(FirebaseApp.getApps(getContext()).isEmpty())FirebaseApp.initializeApp(getContext());
  if(playGamesEnabled&&!gamesInitialized){gamesInitialized=true;PlayGamesSdk.initialize(getActivity());}
  return FirebaseAuth.getInstance();
 }
 private JSObject user(FirebaseUser value) {
  JSObject result=new JSObject(); result.put("uid",value.getUid()); result.put("name",value.getDisplayName()==null?"Guest pilot":value.getDisplayName()); result.put("anonymous",value.isAnonymous());
  JSArray providers=new JSArray(); for(com.google.firebase.auth.UserInfo provider:value.getProviderData()){if(!"firebase".equals(provider.getProviderId()))providers.put(provider.getProviderId());}result.put("providers",providers);return result;
 }
 private void resolveUser(PluginCall call,FirebaseUser value) { JSObject result=new JSObject();result.put("user",value==null?JSObject.NULL:user(value));call.resolve(result); }
 @Override public void load() {
  int id=getContext().getResources().getIdentifier("game_services_project_id","string",getContext().getPackageName());
  playGamesEnabled=id!=0&&!getContext().getString(id).equals("0");
 }
 @PluginMethod public void getPlayerProfile(PluginCall call) {
  // Read the platform gamer tag only after Play Games has authenticated.
  // This cosmetic name never changes the Firebase save/account identity.
  if(!playGamesEnabled){call.resolve(new JSObject());return;}
  getActivity().runOnUiThread(()->PlayGames.getGamesSignInClient(getActivity()).isAuthenticated()
   .addOnSuccessListener(auth->{
    if(!auth.isAuthenticated()){call.resolve(new JSObject());return;}
    PlayGames.getPlayersClient(getActivity()).getCurrentPlayer()
     .addOnSuccessListener(player->{JSObject out=new JSObject();out.put("name",player.getDisplayName());out.put("provider","Google Play Games");call.resolve(out);})
     .addOnFailureListener(error->call.resolve(new JSObject()));
   }).addOnFailureListener(error->call.resolve(new JSObject())));
 }
 @PluginMethod public void restoreSession(PluginCall call) {try{resolveUser(call,current().getCurrentUser());}catch(Exception e){call.reject("Firebase configuration is unavailable.");}}
 @PluginMethod public void signInGuest(PluginCall call) {current().signInAnonymously().addOnSuccessListener(r->resolveUser(call,r.getUser())).addOnFailureListener(e->call.reject(e.getMessage()));}
 @PluginMethod public void getIdToken(PluginCall call) {FirebaseUser user=current().getCurrentUser();if(user==null){call.reject("Not signed in.");return;}user.getIdToken(false).addOnSuccessListener(r->{JSObject out=new JSObject();out.put("token",r.getToken());call.resolve(out);}).addOnFailureListener(e->call.reject(e.getMessage()));}
 @PluginMethod public void beginSignIn(PluginCall call) {if(!"google".equals(call.getString("provider","google"))){call.reject("Unsupported provider.");return;}getActivity().runOnUiThread(()->choose(call,false,false));}
 @PluginMethod public void autoSignIn(PluginCall call) {
  SharedPreferences prefs=getContext().getSharedPreferences("neo_glide_auth",0);
  if(prefs.getBoolean("attempted",false)){call.resolve(new JSObject());return;}prefs.edit().putBoolean("attempted",true).apply();
  getActivity().runOnUiThread(()->choose(call,true,true));
 }
 private void choose(PluginCall call,boolean authorizedOnly,boolean automatic) {
  int resource=getContext().getResources().getIdentifier("default_web_client_id","string",getContext().getPackageName());
  if(resource==0){call.reject("Google sign-in needs its OAuth client configuration.");return;}
  GetGoogleIdOption option=new GetGoogleIdOption.Builder().setServerClientId(getContext().getString(resource)).setFilterByAuthorizedAccounts(authorizedOnly).setAutoSelectEnabled(automatic).build();
  GetCredentialRequest request=new GetCredentialRequest.Builder().addCredentialOption(option).build();
  Executor executor=androidx.core.content.ContextCompat.getMainExecutor(getContext());
  CredentialManager.create(getContext()).getCredentialAsync(getActivity(),request,new CancellationSignal(),executor,new CredentialManagerCallback<GetCredentialResponse,GetCredentialException>() {
   @Override public void onResult(GetCredentialResponse response) {
    try {
     String token=GoogleIdTokenCredential.createFrom(response.getCredential().getData()).getIdToken();candidate=GoogleAuthProvider.getCredential(token,null);
     if(automatic){current().signInWithCredential(candidate).addOnSuccessListener(r->resolveUser(call,r.getUser())).addOnFailureListener(e->call.reject(e.getMessage()));return;}
     FirebaseApp secondary;try{secondary=FirebaseApp.getInstance("candidate");}catch(IllegalStateException e){secondary=FirebaseApp.initializeApp(getContext(),FirebaseApp.getInstance().getOptions(),"candidate");}
     FirebaseAuth.getInstance(secondary).signInWithCredential(candidate).addOnSuccessListener(r->r.getUser().getIdToken(false).addOnSuccessListener(t->{JSObject out=new JSObject();out.put("user",user(r.getUser()));out.put("token",t.getToken());call.resolve(out);}).addOnFailureListener(e->call.reject(e.getMessage()))).addOnFailureListener(e->call.reject(e.getMessage()));
    }catch(Exception e){call.reject(e.getMessage());}
   }
   @Override public void onError(GetCredentialException error){if(authorizedOnly&&error instanceof androidx.credentials.exceptions.NoCredentialException)choose(call,false,true);else call.reject("Google sign-in cancelled or unavailable.");}
  });
 }
 @PluginMethod public void commitSignIn(PluginCall call) {if(candidate==null){call.reject("Sign in again.");return;}current().signInWithCredential(candidate).addOnSuccessListener(r->{candidate=null;resolveUser(call,r.getUser());}).addOnFailureListener(e->call.reject(e.getMessage()));}
 @PluginMethod public void signOut(PluginCall call) {current().signOut();call.resolve();}
 @PluginMethod public void deleteAccount(PluginCall call) {FirebaseUser user=current().getCurrentUser();if(user==null){call.resolve();return;}user.delete().addOnSuccessListener(v->call.resolve()).addOnFailureListener(e->call.reject(e.getMessage()));}
}
