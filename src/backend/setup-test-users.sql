-- ================================================
-- VF物流系统 - 测试用户账号设置
-- ================================================
-- 表：APP_CMS.RWSYS_USER
-- 
-- 字段说明：
--   USERID        - 登录账号（主键）
--   PASSWORD      - 密码（明文，实际生产应加密）
--   USER_NAME_C   - 用户姓名/说明
--   CUSTOMERNO    - 可查看的品牌范围（逗号分隔）
--                   空或'all' = 管理员（查看所有品牌）
--                   '18405' = DICKIES
--                   '18405-1' = TNF
--                   '18405-2' = VANS
--                   '18405-3' = TIMBERLAND
--                   '18405-4' = ICEBREAKER
--                   '18405-5' = SMARTWOOL
--   ACTIVE_FLAG   - 账号状态（Y=启用，N=停用）
--   CREATE_TIME   - 创建时间
-- ================================================

-- 1. 系统管理员（可查看所有品牌）
INSERT INTO APP_CMS.RWSYS_USER 
(USERID, PASSWORD, USER_NAME_C, CUSTOMERNO, ACTIVE_FLAG, CREATE_TIME)
VALUES 
('admin', 'admin123', '系统管理员', '', 'Y', SYSDATE);

-- 2. DICKIES品牌经理（只能查看DICKIES）
INSERT INTO APP_CMS.RWSYS_USER 
(USERID, PASSWORD, USER_NAME_C, CUSTOMERNO, ACTIVE_FLAG, CREATE_TIME)
VALUES 
('dickies', '123456', 'DICKIES品牌经理', '18405', 'Y', SYSDATE);

-- 3. TNF品牌经理（只能查看TNF）
INSERT INTO APP_CMS.RWSYS_USER 
(USERID, PASSWORD, USER_NAME_C, CUSTOMERNO, ACTIVE_FLAG, CREATE_TIME)
VALUES 
('tnf', '123456', 'TNF品牌经理', '18405-1', 'Y', SYSDATE);

-- 4. VANS品牌经理（只能查看VANS）
INSERT INTO APP_CMS.RWSYS_USER 
(USERID, PASSWORD, USER_NAME_C, CUSTOMERNO, ACTIVE_FLAG, CREATE_TIME)
VALUES 
('vans', '123456', 'VANS品牌经理', '18405-2', 'Y', SYSDATE);

-- 5. 演示账号（可查看DICKIES和TNF两个品牌）
INSERT INTO APP_CMS.RWSYS_USER 
(USERID, PASSWORD, USER_NAME_C, CUSTOMERNO, ACTIVE_FLAG, CREATE_TIME)
VALUES 
('demo', 'demo', '演示账号', '18405,18405-1', 'Y', SYSDATE);

-- 6. 测试账号（用于调试）
INSERT INTO APP_CMS.RWSYS_USER 
(USERID, PASSWORD, USER_NAME_C, CUSTOMERNO, ACTIVE_FLAG, CREATE_TIME)
VALUES 
('testuser', 'testpass', '测试账号', '18405', 'Y', SYSDATE);

-- 提交事务
COMMIT;

-- ================================================
-- 验证插入的数据
-- ================================================
SELECT 
    USERID AS "用户名",
    PASSWORD AS "密码",
    USER_NAME_C AS "用户说明",
    CUSTOMERNO AS "品牌权限",
    ACTIVE_FLAG AS "状态",
    CREATE_TIME AS "创建时间"
FROM APP_CMS.RWSYS_USER
ORDER BY CREATE_TIME DESC;

-- ================================================
-- 常用维护命令
-- ================================================

-- 查看所有用户
-- SELECT * FROM APP_CMS.RWSYS_USER;

-- 停用某个用户
-- UPDATE APP_CMS.RWSYS_USER SET ACTIVE_FLAG = 'N' WHERE USERID = 'demo';
-- COMMIT;

-- 启用某个用户
-- UPDATE APP_CMS.RWSYS_USER SET ACTIVE_FLAG = 'Y' WHERE USERID = 'demo';
-- COMMIT;

-- 修改密码
-- UPDATE APP_CMS.RWSYS_USER SET PASSWORD = 'newpass' WHERE USERID = 'demo';
-- COMMIT;

-- 修改品牌权限
-- UPDATE APP_CMS.RWSYS_USER SET CUSTOMERNO = '18405,18405-1,18405-2' WHERE USERID = 'demo';
-- COMMIT;

-- 删除测试账号
-- DELETE FROM APP_CMS.RWSYS_USER WHERE USERID = 'testuser';
-- COMMIT;
