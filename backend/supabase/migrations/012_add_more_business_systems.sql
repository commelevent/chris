-- 添加更多业务系统数据
-- 扩展业务系统列表，包含更多实际业务场景

-- ============================================
-- 插入新的业务系统数据
-- ============================================
INSERT INTO business_systems (id, name, code, description, status) VALUES
('dddddddd-dddd-dddd-dddd-dddddddddddd', '运维服务平台（自研版）', 'ops-platform', '企业级运维服务平台，提供监控告警、自动化运维、CMDB等核心功能', 'active'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '容器云平台', 'container-cloud', '基于 Kubernetes 的容器云管理平台，支持应用编排、服务治理、弹性伸缩', 'active'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', '数据库运维平台', 'db-ops', '数据库统一运维管理平台，支持 MySQL、PostgreSQL、Redis 等多数据库管理', 'active'),
('10101010-1010-1010-1010-101010101010', '配置管理中心', 'config-center', '分布式配置管理平台，支持多环境配置、灰度发布、配置回滚', 'active'),
('11111111-2222-3333-4444-555555555555', '监控告警平台', 'monitor-alert', '统一监控告警平台，集成 Prometheus、Grafana，支持多渠道告警通知', 'active'),
('22222222-3333-4444-5555-666666666666', 'CI/CD 流水线', 'cicd-pipeline', '持续集成与持续部署平台，支持代码构建、自动化测试、灰度发布', 'active'),
('33333333-4444-5555-6666-777777777777', 'API 网关平台', 'api-gateway', '统一 API 网关管理平台，支持流量控制、熔断降级、安全认证', 'active'),
('44444444-5555-6666-7777-888888888888', '消息队列平台', 'mq-platform', '消息队列统一管理平台，支持 Kafka、RabbitMQ、RocketMQ 集群管理', 'active')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 完成
-- ============================================
SELECT 'Additional business systems added successfully!' as message;
