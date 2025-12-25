<?php
require 'login.php';

if (array_key_exists('push',$_REQUEST))	{	// Master mode, updates database with new hash
	$dbconn=pg_connect("host=".$host." dbname=".$dbname." user=".$user." password=".$password) or die ('Impossible to connect to the database: '.pg_last_error());
	if (!pg_meta_data($dbconn,'slides')) {
		$query="create table slides (name varchar(30) primary key, hash varchar(50), interactive text)";
		$result=pg_query($dbconn, $query) or die('Request failed: '.pg_last_error());
		pg_free_result($result);
		$query="create or replace function notify_slides() returns trigger as $$
			begin
				perform pg_notify(new.name,new.hash);
				return new;
			end;
			$$ language plpgsql;";
		$result=pg_query($dbconn, $query) or die('Request failed: '.pg_last_error());
		pg_free_result($result);
		$query="create or replace trigger notify_update_slides after insert or update on slides for each row execute procedure notify_slides()";
		$result=pg_query($dbconn, $query) or die('Request failed: '.pg_last_error());
		pg_free_result($result);
	}
	if (!array_key_exists('interactive', $_REQUEST)) $_REQUEST["interactive"]="";
	$query="insert into slides values ($1, $2, $3) on conflict(name) do update set hash=EXCLUDED.hash, interactive=EXCLUDED.interactive";
	$result=pg_query_params($dbconn, $query, array($_REQUEST['push'], $_REQUEST['hash'], $_REQUEST['interactive'])) or die('Request failed: '.pg_last_error());
	pg_free_result($result);
	pg_close($dbconn);
} elseif (array_key_exists('register',$_REQUEST)) {	// Slave mode with HTML5 server-sent events, connection kept alive, changes in database are immediatly sent to client
	$dbconn=pg_connect("host=".$host." dbname=".$dbname." user=".$user." password=".$password) or die ('Impossible to connect to the database: '.pg_last_error());
	header("X-Accel-Buffering: no");
	header('Content-Type: text/event-stream');
	header('Cache-Control: no-cache');
	$query='listen '.pg_escape_identifier($dbconn, $_REQUEST['register']);
	$result=pg_query($dbconn, $query) or die('Request failed: '.pg_last_error());
	register_shutdown_function(function($dbconn,$result) {
		pg_free_result($result);
		pg_close($dbconn);
	},$dbconn,$result);
	while (true) {
		$notify=pg_get_notify($dbconn,PGSQL_ASSOC);
		if ($notify) {
			echo 'data: '.$notify['payload'].PHP_EOL;
			echo PHP_EOL;
			if (ob_get_contents()) {ob_end_flush();}
			flush();
		}
		if (connection_aborted()) break;
		sleep(1);
	}
	pg_close($dbconn);
} elseif (array_key_exists('pull',$_REQUEST)) {	// Slave mode with no HTML5 server-sent events, client has to poll at regular intervals
	$dbconn=pg_connect("host=".$host." dbname=".$dbname." user=".$user." password=".$password) or die ('Impossible to connect to the database: '.pg_last_error());
	$query="select hash from slides where name=$1";
	$result=pg_query_params($dbconn, $query, array($_REQUEST['pull'])) or die('Request failed: '.pg_last_error());
	$val=pg_fetch_array($result,null,PGSQL_ASSOC);
	if ($val) echo $val['hash'];
	pg_free_result($result);
	pg_close($dbconn);
} elseif (array_key_exists('wait', $_REQUEST)) {	// Goes into waiting mode for interactive slideshows
	echo <<<END
	<!DOCTYPE html>
	<html>
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
	END;
	if (array_key_exists('css', $_REQUEST)) echo '<link rel="stylesheet" href="'.$_REQUEST["css"].'">';
	echo <<<END
		<script src="sync.js"></script>
	</head>
	<body>
	</body>
	</html>
	END;
} elseif (array_key_exists('subscribe', $_REQUEST)) {	// Subscribe to server-sent events for new polls
	$dbconn=pg_connect("host=".$host." dbname=".$dbname." user=".$user." password=".$password) or die ('Impossible to connect to the database: '.pg_last_error());
	header("X-Accel-Buffering: no");
	header('Content-Type: text/event-stream');
	header('Cache-Control: no-cache');
	$query='listen '.pg_escape_identifier($dbconn, $_REQUEST['subscribe']);
	$result=pg_query($dbconn, $query) or die('Request failed: '.pg_last_error());
	register_shutdown_function(function($dbconn,$result) {
		pg_free_result($result);
		pg_close($dbconn);
	},$dbconn,$result);
	while (true) {
		$notify=pg_get_notify($dbconn,PGSQL_NUM);
		if ($notify) {
			$query="select interactive from slides where name=$1";
			$res=pg_query_params($dbconn, $query, array($_REQUEST['subscribe'])) or die('Request failed: '.pg_last_error());
			$val=pg_fetch_array($res,null,PGSQL_ASSOC);
			pg_free_result($res);
			if ($val) {
				$arr = explode("\n", $val['interactive']);
				foreach ($arr as $line) echo 'data: '.$line.PHP_EOL;
				echo PHP_EOL;
				if (ob_get_contents()) {ob_end_flush();}
				flush();
			}
		}
		if (connection_aborted()) break;
		sleep(1);
	}
	pg_close($dbconn);
} elseif (array_key_exists('submit', $_REQUEST) && array_key_exists('poll', $_REQUEST)) {	// Submit an answer to a poll
	$dbconn=pg_connect("host=".$host." dbname=".$dbname." user=".$user." password=".$password) or die ('Impossible to connect to the database: '.pg_last_error());
	if (!pg_meta_data($dbconn,'polls')) {
		$query="create table polls (name varchar(30), poll text, answers jsonb, constraint polls_pkey primary key (name, poll))";
		$result=pg_query($dbconn, $query) or die('Request failed: '.pg_last_error());
		pg_free_result($result);
		$query="create or replace function notify_polls() returns trigger as $$
			begin
				perform pg_notify(new.name || new.poll,new.answers::text);
				return new;
			end;
			$$ language plpgsql;";
		$result=pg_query($dbconn, $query) or die('Request failed: '.pg_last_error());
		pg_free_result($result);
		$query="create or replace trigger notify_update_polls after insert or update on polls for each row execute procedure notify_polls()";
		$result=pg_query($dbconn, $query) or die('Request failed: '.pg_last_error());
		pg_free_result($result);
	}
	// If the poll is not in the database, create a row with the given answers. Otherwise combines the existing JSON value for answers with the new one by adding the corresponding fields.
	$query="insert into polls values ($1, $2, cast ($3 as jsonb) || '{\"number\":1}'::jsonb) on conflict on constraint polls_pkey do update set answers=(select jsonb_object_agg(key, total) from (select key, sum(value::numeric) as total from (select * from jsonb_each(polls.answers) union all select * from jsonb_each(excluded.answers) as combined) group by key) as summed)";
	$result=pg_query_params($dbconn, $query, array($_REQUEST['submit'], $_REQUEST['poll'], $_REQUEST['answers'])) or die('Request failed: '.pg_last_error());
	pg_free_result($result);
	pg_close($dbconn);
} elseif (array_key_exists('follow', $_REQUEST) && array_key_exists('poll', $_REQUEST)) {	// Get events for updates on a poll
	$dbconn=pg_connect("host=".$host." dbname=".$dbname." user=".$user." password=".$password) or die ('Impossible to connect to the database: '.pg_last_error());
	header("X-Accel-Buffering: no");
	header('Content-Type: text/event-stream');
	header('Cache-Control: no-cache');
	$query='listen '.pg_escape_identifier($dbconn, $_REQUEST['follow'].$_REQUEST['poll']);
	$result=pg_query($dbconn, $query) or die('Request failed: '.pg_last_error());
	register_shutdown_function(function($dbconn,$result) {
		pg_free_result($result);
		pg_close($dbconn);
	},$dbconn,$result);
	$first = true;
	while (true) {
		$notify=pg_get_notify($dbconn,PGSQL_NUM);
		if ($notify || $first) {
			$query="select answers from polls where name=$1 and poll=$2";
			$res=pg_query_params($dbconn, $query, array($_REQUEST['follow'], $_REQUEST['poll'])) or die('Request failed: '.pg_last_error());
			$ret=pg_fetch_array($res, null, PGSQL_ASSOC);
			pg_free_result($res);
			if ($ret) {
				echo "data: ".$ret["answers"].PHP_EOL;
				echo PHP_EOL;
				if (ob_get_contents()) {ob_end_flush();}
				flush();
			}
			$first = false;
		}
		if (connection_aborted()) break;
		sleep(1);
	}
	pg_close($dbconn);
} 
?>
