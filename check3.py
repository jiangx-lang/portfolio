import pandas as pd
from supabase import create_client

sb = create_client('https://wpsiqvbhxhzrynfhbwno.supabase.co', 'sb_publishable_8sWmy_vOCTdplogyWYhxbg_ACf1Uxrz')
r = sb.table('nav_history').select('isin,ccy,nav_date,nav').eq('isin','LU0056508442').limit(5).execute()
print('Supabase 里的数据:', r.data)
