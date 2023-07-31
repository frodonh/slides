--
-- PostgreSQL database dump
--

-- Dumped from database version 12.9 (Ubuntu 12.9-0ubuntu0.20.04.1)
-- Dumped by pg_dump version 12.9 (Ubuntu 12.9-0ubuntu0.20.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: notify_slides(); Type: FUNCTION; Schema: public; Owner: francois
--

CREATE FUNCTION public.notify_slides() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
			begin
				perform pg_notify(old.name,new.hash);
				return new;
			end;
			$$;


ALTER FUNCTION public.notify_slides() OWNER TO francois;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: slides; Type: TABLE; Schema: public; Owner: francois
--

CREATE TABLE public.slides (
    name character varying(30) NOT NULL,
    hash character varying(50)
);


ALTER TABLE public.slides OWNER TO francois;

--
-- Name: slides slides_pkey; Type: CONSTRAINT; Schema: public; Owner: francois
--

ALTER TABLE ONLY public.slides
    ADD CONSTRAINT slides_pkey PRIMARY KEY (name);


--
-- Name: slides notify_update; Type: TRIGGER; Schema: public; Owner: francois
--

CREATE TRIGGER notify_update AFTER UPDATE ON public.slides FOR EACH ROW EXECUTE FUNCTION public.notify_slides();


--
-- PostgreSQL database dump complete
--

