-- 彻底清理重复的业务系统数据
-- 删除名称重复的业务系统，只保留每个名称最先创建的记录

-- ============================================
-- 步骤 1：查看重复数据
-- ============================================
-- 先查看有哪些重复的业务系统（按名称）
SELECT name, COUNT(*) as count, array_agg(code) as codes
FROM business_systems
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- ============================================
-- 步骤 2：删除重复数据
-- ============================================
-- 删除所有名称重复的业务系统，只保留每个名称最先创建的记录
DELETE FROM business_systems 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM business_systems 
  GROUP BY name
);

-- ============================================
-- 步骤 3：验证清理结果
-- ============================================
-- 再次检查是否还有重复（按名称）
SELECT name, COUNT(*) as count
FROM business_systems
GROUP BY name
HAVING COUNT(*) > 1;

-- ============================================
-- 完成
-- ============================================
SELECT 'Duplicate business systems cleaned successfully!' as message;
