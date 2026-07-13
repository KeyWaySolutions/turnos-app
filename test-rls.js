const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zoeobxnhcuzebtvzenke.supabase.co';
const supabaseAnonKey = 'sb_publishable_2KIH6V58Jphj3xeo4FQ_kw_o_wfJugG';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'Password123!';

  console.log(`Signing up test user: ${testEmail}`);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword
  });

  if (signUpError) {
    console.error("SignUp Error:", signUpError);
    return;
  }

  const user = signUpData.user;
  console.log("SignUp Success. User ID:", user.id);

  // Now, try to select from 'servicios'
  console.log("Querying 'servicios' table...");
  const { data: selectData, error: selectError } = await supabase
    .from('servicios')
    .select('*')
    .eq('user_id', user.id);

  if (selectError) {
    console.error("SELECT Error:", {
      code: selectError.code,
      message: selectError.message,
      details: selectError.details,
      hint: selectError.hint
    });
  } else {
    console.log("SELECT Success! Data:", selectData);
  }

  // Try to insert
  console.log("Attempting INSERT into 'servicios'...");
  const { data: insertData, error: insertError } = await supabase
    .from('servicios')
    .insert([
      { user_id: user.id, nombre: 'Servicio Test RLS', duracion: 45 }
    ])
    .select();

  if (insertError) {
    console.error("INSERT Error:", {
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint
    });
  } else {
    console.log("INSERT Success! Data:", insertData);
    
    // Clean up if inserted
    console.log("Attempting DELETE...");
    const { error: deleteError } = await supabase
      .from('servicios')
      .delete()
      .eq('id', insertData[0].id);
      
    if (deleteError) {
       console.error("DELETE Error:", deleteError);
    } else {
       console.log("DELETE Success!");
    }
  }
}

run();
