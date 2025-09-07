-- Create indexes on personId for all shot tables to optimize player queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shots_2013_14_personid ON public."shots_2013-14" (personId);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shots_2014_15_personid ON public."shots_2014-15" (personId);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shots_2015_16_personid ON public."shots_2015-16" (personId);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shots_2016_17_personid ON public."shots_2016-17" (personId);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shots_2017_18_personid ON public."shots_2017-18" (personId);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shots_2018_19_personid ON public."shots_2018-19" (personId);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shots_2019_20_personid ON public."shots_2019-20" (personId);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shots_2020_21_personid ON public."shots_2020-21" (personId);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shots_2021_22_personid ON public."shots_2021-22" (personId);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shots_2022_23_personid ON public."shots_2022-23" (personId);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shots_2023_24_personid ON public."shots_2023-24" (personId);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shots_2024_25_personid ON public."shots_2024-25" (personId);