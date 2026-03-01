# -*- coding: utf-8 -*-
"""
渣打 WMP 数据库管理入口（与 wmp_db 同实现，满足「db_manager」命名约定）。
"""
from wmp_db import get_connection, get_wmp_display_data, init_db, insert_nav_records

__all__ = ["init_db", "insert_nav_records", "get_wmp_display_data", "get_connection"]
